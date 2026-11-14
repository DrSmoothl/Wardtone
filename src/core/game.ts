import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import type { Location, Inventory, BundleView } from "../shared/model";
import { safeRelative } from "../shared/model";
import { Store, isMissing } from "./storage";
import { LocalTransport, type Transport } from "./local";
import { AdbTransport, connectAdb, shell } from "./adb";
import { readBundle, audioClips, payload, sha256 } from "./unity";
import { parseFsb } from "./audio";
import { getClipCue, cueEvidenceVersion } from "../shared/cues";
import { isMusicBundle } from "../shared/resources";
import { musicCatalog } from "../shared/music";
import { discoverWindowsRoots } from "./windows-discovery";

export const manifestName = "persistent_res_list.json";
const hotUpdateManifestName = "hot_update_list.json";
export const manifestSchema = z
  .object({
    manifestName: z.string(),
    manifestVersion: z.string(),
    abInfos: z
      .array(
        z
          .object({
            name: safeRelative,
            hash: z.string(),
            md5: z.string().regex(/^(?:[a-f0-9]{4}|[a-f0-9]{32})$/i),
            abSize: z.number().int(),
            totalSize: z.number().optional(),
          })
          .passthrough(),
      )
      .max(200000),
  })
  .passthrough();
const hotUpdateManifestSchema = manifestSchema.extend({
  versionId: z.string().min(1),
});
export type Manifest = z.infer<typeof manifestSchema>;
export const md5 = (data: Buffer) =>
  createHash("md5").update(data).digest("hex");
export const targetBundle = (name: string) =>
  isMusicBundle(name) ||
  /^audio\/(?:autochess_skin_se\/[^/]+|custom_se\/act\d+autochess|sound_beta_\d+\/voice(?:_[^/]+)?\/ac_[^/]+|persist_se\/persist_se_\d+)\.ab$/.test(
    name,
  );
export const targetClip = (bundle: string, name: string) =>
  !bundle.includes("/persist_se/") || name.startsWith("autochess_");
export const eventName = (clip: string, bundle: string) =>
  getClipCue(bundle, clip)?.title ?? "用途待核对";
export function bundleLabel(name: string) {
  if (isMusicBundle(name))
    return {
      language: "背景音乐",
      label:
        musicCatalog.find((item) => item.bundle === name)?.title ??
        path.basename(name, ".ab"),
    };
  const language = name.includes("/voice_cn/")
    ? "中文"
    : name.includes("/voice/")
      ? "日语"
      : name.includes("/voice_")
        ? name.split("/").at(-2)!.slice(6)
        : "通用";
  const label = name.includes("ac_s_closur")
    ? "可露希尔"
    : name.includes("ac_n_iron")
      ? "乌萨斯齐心团"
      : name.includes("/persist_se/")
        ? "公共播报与音效 · " + path.basename(name, ".ab").split("_").at(-1)
        : /^audio\/custom_se\/act\d+autochess\.ab$/.test(name)
          ? "活动战斗音效"
          : path.basename(name, ".ab");
  return { language, label };
}
export async function transport(
  location: Location,
  store: Store,
): Promise<Transport> {
  return location.kind === "local"
    ? new LocalTransport(location)
    : new AdbTransport(location, await connectAdb(location, store));
}
export async function readManifest(t: Transport) {
  const bytes = await t.read(manifestName),
    value = manifestSchema.parse(JSON.parse(bytes.toString()));
  const seen = new Set<string>();
  for (const entry of value.abInfos) {
    if (seen.has(entry.name))
      throw new Error("清单资源名称重复：" + entry.name);
    seen.add(entry.name);
    if (targetBundle(entry.name) && entry.md5.length !== 32)
      throw new Error("卫戍资源清单未提供完整 MD5：" + entry.name);
  }
  return { bytes, value };
}
async function scanTargets(
  t: Transport,
  persistent: Manifest,
  store: Store,
  operation: string,
) {
  const targets = persistent.abInfos.filter((entry) =>
      targetBundle(entry.name),
    ),
    supplemental = new Set<string>();
  const context: Record<string, unknown> = {
    path: hotUpdateManifestName,
    persistentManifestName: persistent.manifestName,
    persistentManifestVersion: persistent.manifestVersion,
  };
  try {
    if (!(await t.exists(hotUpdateManifestName))) {
      await store.log("warn", operation, "scan.catalog.absent", {
        path: hotUpdateManifestName,
        scope: "persistent",
        candidateBundles: targets.length,
      });
      return { targets, supplemental };
    }
    const bytes = await t.read(hotUpdateManifestName),
      catalog = hotUpdateManifestSchema.parse(JSON.parse(bytes.toString()));
    Object.assign(context, {
      catalogSha256: sha256(bytes),
      catalogManifestName: catalog.manifestName,
      catalogManifestVersion: catalog.manifestVersion,
      versionId: catalog.versionId,
    });
    if (
      catalog.manifestName !== persistent.manifestName ||
      catalog.manifestVersion !== persistent.manifestVersion
    ) {
      throw new Error(
        `热更新清单与本地资源清单版本不一致：${catalog.manifestName} / ${catalog.manifestVersion}，本地为 ${persistent.manifestName} / ${persistent.manifestVersion}。请先在游戏中完成资源更新`,
      );
    }
    const names = new Set<string>(),
      catalogTargets = new Map<string, Manifest["abInfos"][number]>();
    for (const entry of catalog.abInfos) {
      if (names.has(entry.name))
        throw new Error("热更新清单资源名称重复：" + entry.name);
      names.add(entry.name);
      if (!targetBundle(entry.name)) continue;
      if (entry.md5.length !== 32)
        throw new Error("热更新卫戍资源清单未提供完整 MD5：" + entry.name);
      if (entry.abSize <= 0)
        throw new Error("热更新卫戍资源清单大小无效：" + entry.name);
      catalogTargets.set(entry.name, entry);
    }
    for (const entry of targets) {
      const official = catalogTargets.get(entry.name);
      if (!official)
        throw new Error("同版本热更新清单缺少本地卫戍资源：" + entry.name);
      const conflicts: string[] = [];
      if (entry.md5.toLowerCase() !== official.md5.toLowerCase())
        conflicts.push("MD5");
      if (entry.hash.toLowerCase() !== official.hash.toLowerCase())
        conflicts.push("资源 hash");
      // 变长模式只把本地 abSize 设为 0；扫描与写入仍保留本地清单的摘要和大小。
      if (entry.abSize !== 0 && entry.abSize !== official.abSize)
        conflicts.push("大小");
      if (conflicts.length) {
        context.conflict = {
          path: entry.name,
          fields: conflicts,
          persistent: {
            md5: entry.md5,
            hash: entry.hash,
            abSize: entry.abSize,
          },
          catalog: {
            md5: official.md5,
            hash: official.hash,
            abSize: official.abSize,
          },
        };
        throw new Error(
          `热更新清单与本地清单资源信息冲突（${conflicts.join("、")}）：${entry.name}`,
        );
      }
      catalogTargets.delete(entry.name);
    }
    for (const entry of catalogTargets.values()) {
      targets.push(entry);
      supplemental.add(entry.name);
    }
    await store.log("info", operation, "scan.catalog.loaded", {
      path: hotUpdateManifestName,
      manifestName: catalog.manifestName,
      manifestVersion: catalog.manifestVersion,
      versionId: catalog.versionId,
      sha256: sha256(bytes),
      entries: catalog.abInfos.length,
      candidateBundles: targets.length,
      supplementalBundles: supplemental.size,
    });
    return { targets, supplemental };
  } catch (error) {
    await store.log("error", operation, "scan.catalog.failed", {
      ...context,
      error: String(error),
    });
    throw error;
  }
}
export async function scan(
  t: Transport,
  managed: Set<string>,
  store: Store,
  operation: string,
): Promise<Inventory> {
  const { bytes, value } = await readManifest(t);
  const bundles: BundleView[] = [],
    warnings: string[] = [];
  const { targets, supplemental } = await scanTargets(
    t,
    value,
    store,
    operation,
  );
  if (!targets.length)
    throw new Error("清单中没有找到卫戍协议资源，请先在游戏中下载该模式及语音");
  await store.log("info", operation, "scan.started", {
    location: t.location.id,
    manifestVersion: value.manifestVersion,
    manifestSha: sha256(bytes),
    manifestEntries: value.abInfos.length,
    candidateBundles: targets.length,
  });
  for (const entry of targets) {
    const base = {
      path: entry.name,
      ...bundleLabel(entry.name),
      expectedBytes: entry.abSize,
      expectedMd5: entry.md5,
    };
    if (!(await t.exists(entry.name))) {
      bundles.push({
        ...base,
        bytes: 0,
        sha256: "",
        md5: "",
        status: "missing",
        clips: [],
      });
      warnings.push(
        supplemental.has(entry.name)
          ? "尚未下载卫戍协议资源，请先在游戏中下载对应活动或语音包：" +
              entry.name
          : "缺少资源：" + entry.name,
      );
      await store.log("warn", operation, "scan.bundle.missing", {
        path: entry.name,
        expectedBytes: entry.abSize,
        source: supplemental.has(entry.name)
          ? hotUpdateManifestName
          : manifestName,
      });
      continue;
    }
    if (supplemental.has(entry.name)) {
      const error =
        "资源已落盘但尚未登记到本地下载清单，请先在游戏中完成资源下载：" +
        entry.name;
      await store.log("error", operation, "scan.bundle.unregistered", {
        path: entry.name,
        error,
      });
      throw new Error(error);
    }
    const data = await t.read(entry.name),
      hash = sha256(data),
      checksum = md5(data),
      bundle = readBundle(data);
    const allClips = audioClips(bundle);
    const clips = allClips
      .filter((c) => targetClip(entry.name, c.name))
      .map((c) => ({
        name: c.name,
        event: eventName(c.name, entry.name),
        duration: c.duration,
        rate: c.frequency,
        channels: c.channels,
        bytes: c.size,
        codec: parseFsb(payload(bundle, c)).codec,
      }));
    if (!clips.length) {
      await store.log("info", operation, "scan.bundle.no-matching-clips", {
        path: entry.name,
        totalClips: allClips.length,
      });
      continue;
    }
    bundles.push({
      ...base,
      bytes: data.length,
      sha256: hash,
      md5: checksum,
      status:
        checksum.toLowerCase() === entry.md5.toLowerCase()
          ? "official"
          : managed.has(hash)
            ? "managed"
            : "changed",
      clips,
    });
    await store.log("info", operation, "scan.bundle", {
      path: entry.name,
      bytes: data.length,
      clips: clips.length,
      totalClips: allClips.length,
      sha256: hash,
    });
  }
  const unannotated = bundles.flatMap((bundle) =>
    bundle.clips
      .filter((clip) => !getClipCue(bundle.path, clip.name))
      .map((clip) => ({ bundle: bundle.path, clip: clip.name })),
  );
  const unresolved = bundles.flatMap((bundle) =>
    bundle.clips
      .filter(
        (clip) =>
          getClipCue(bundle.path, clip.name)?.status === "trigger-unresolved",
      )
      .map((clip) => ({ bundle: bundle.path, clip: clip.name })),
  );
  if (unannotated.length)
    warnings.push(
      `${unannotated.length} 条资源的播放用途尚未核对，可在语音库查看原始编号`,
    );
  await store.log(
    unannotated.length || unresolved.length ? "warn" : "info",
    operation,
    "scan.cue-coverage",
    { evidence: cueEvidenceVersion, unannotated, unresolved },
  );
  await store.log("info", operation, "scan.completed", {
    candidateBundles: targets.length,
    bundles: bundles.length,
    clips: bundles.reduce((count, bundle) => count + bundle.clips.length, 0),
    missing: bundles.filter((bundle) => bundle.status === "missing").length,
  });
  return {
    location: t.location,
    version: value.manifestVersion,
    manifestSha: sha256(bytes),
    bundles,
    warnings,
  };
}
async function readableDirectory(folder: string, store: Store) {
  try {
    return await fs.readdir(folder, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return [];
    if (
      ["EACCES", "EPERM"].includes((error as NodeJS.ErrnoException).code ?? "")
    ) {
      await store.log("warn", "discovery", "directory.denied", {
        folder,
        error: String(error),
      });
      return [];
    }
    throw error;
  }
}
export async function findRoots(start: string, store: Store, maxDepth = 5) {
  const found: string[] = [],
    queue = [{ folder: start, depth: 0 }];
  let visited = 0;
  while (queue.length) {
    const { folder, depth } = queue.shift()!;
    if (++visited > 12000)
      throw new Error("目录搜索超过 12,000 个文件夹，请选择更接近游戏的目录");
    const entries = await readableDirectory(folder, store);
    if (entries.some((e) => e.isFile() && e.name === manifestName)) {
      found.push(folder);
      continue;
    }
    if (depth >= maxDepth) continue;
    for (const entry of entries)
      if (
        entry.isDirectory() &&
        !["node_modules", ".git", "Cache", "Caches", "ShaderCache"].includes(
          entry.name,
        )
      )
        queue.push({ folder: path.join(folder, entry.name), depth: depth + 1 });
  }
  return found;
}
export async function discoverLocal(store: Store) {
  const candidates: string[] = [];
  if (process.env.WARDTONE_TEST_GAME)
    candidates.push(process.env.WARDTONE_TEST_GAME);
  if (process.platform === "darwin") {
    const containers = path.join(os.homedir(), "Library", "Containers");
    for (const entry of await readableDirectory(containers, store))
      if (entry.isDirectory())
        candidates.push(
          path.join(containers, entry.name, "Data", "Documents", "Bundles"),
        );
    candidates.push(
      path.join(
        os.homedir(),
        "Library",
        "Application Support",
        "com.playcover.PlayCover",
      ),
    );
  } else if (process.platform === "win32") {
    const roots = await discoverWindowsRoots(store);
    for (const root of roots)
      candidates.push(...(await findRoots(root, store, 5)));
  }
  const result: Location[] = [];
  const seen = new Set<string>();
  for (const folder of new Set(candidates)) {
    try {
      const stat = await fs.stat(path.join(folder, manifestName));
      if (stat.isFile()) {
        const root = await fs.realpath(folder);
        const key = process.platform === "win32" ? root.toLowerCase() : root;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          id: randomUUID(),
          kind: "local",
          root,
          label:
            process.platform === "darwin"
              ? "明日方舟 · macOS"
              : "明日方舟 · Windows",
        });
      }
    } catch (error) {
      if (isMissing(error)) continue;
      await store.log("warn", "discovery", "candidate.unreadable", {
        folder,
        error: String(error),
      });
    }
  }
  await store.log("info", "discovery", "local.completed", {
    platform: process.platform,
    candidates: candidates.length,
    locations: result.map((location) => location.root),
  });
  return result;
}
export async function discoverAdb(location: Location, store: Store) {
  const adb = await connectAdb(location, store);
  try {
    const roots: string[] = [];
    for (const pkg of [
      "com.hypergryph.arknights",
      "com.hypergryph.arknights.bilibili",
    ]) {
      const base = "/sdcard/Android/data/" + pkg + "/files";
      const output = await shell(adb, [
        "sh",
        "-c",
        `if [ -d '${base}' ]; then find '${base}' -maxdepth 6 -name '${manifestName}'; fi`,
      ]);
      for (const file of output.trim().split("\n").filter(Boolean))
        roots.push(path.posix.dirname(file));
    }
    return roots.map((root) => ({ ...location, id: randomUUID(), root }));
  } finally {
    await adb.close();
  }
}
export async function gameRunning(t: Transport): Promise<boolean> {
  if (t instanceof AdbTransport) {
    const result = await shell(t.adb, ["sh", "-c", "ps -A"]);
    return /com\.hypergryph\.arknights/.test(result);
  }
  const result =
    process.platform === "win32"
      ? await promisify(execFile)("tasklist.exe", ["/FO", "CSV", "/NH"], {
          windowsHide: true,
          timeout: 8000,
        })
      : await promisify(execFile)("ps", ["-axo", "comm="], { timeout: 8000 });
  return /(?:^|[\\/"\s])Arknights(?:\.exe)?(?:["\s]|$)|明日方舟\.exe/im.test(
    result.stdout,
  );
}
