import { parentPort, workerData } from "node:worker_threads";
import * as fs from "node:fs/promises";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { zipSync, strToU8 } from "fflate";
import { z } from "zod";
import { Store } from "../core/storage";
import {
  configSchema,
  defaultConfig,
  locationSchema,
  packSchema,
  entrySchema,
  safeRelative,
  type Location,
  type AppState,
} from "../shared/model";
import {
  discoverLocal,
  discoverAdb,
  findRoots,
  transport,
  scan,
  readManifest,
  targetBundle,
} from "../core/game";
import { listDevices } from "../core/adb";
import { Transactions } from "../core/transactions";
import {
  newPack,
  importPack,
  exportPack,
  encodeAudio,
  entriesFromBundle,
} from "../core/packs";
import { readBundle, audioClips, payload } from "../core/unity";
import { fsbPreview, encodeIma } from "../core/audio";

const store = new Store(workerData.dataPath),
  transactions = new Transactions(store);
let startupError: unknown;
const initialized = store.init().catch((error) => {
  startupError = error;
});
store.on("log", (line) => parentPort!.postMessage({ type: "log", line }));
let codebooks: Record<string, string>;
const selected = () => {
  const location = store.config.locations.find(
    (x) => x.id === store.config.selected,
  );
  if (!location) throw new Error("请先选择游戏资源目录");
  return location;
};
async function withGame<T>(
  fn: (t: Awaited<ReturnType<typeof transport>>) => Promise<T>,
) {
  const t = await transport(selected(), store);
  try {
    return await fn(t);
  } finally {
    await t.close();
  }
}
async function state(): Promise<AppState> {
  return {
    config: store.config,
    packs: await store.packs(),
    journals: await transactions.views(),
    platform: process.platform,
    version: workerData.version,
    dataPath: store.root,
  };
}
async function preview(fsb: Buffer) {
  codebooks ??= JSON.parse(await fs.readFile(workerData.codebooksPath, "utf8"));
  const result = fsbPreview(fsb, codebooks);
  return { mime: result.mime, bytes: new Uint8Array(result.data) };
}
async function boundedRead(file: string, max = 128 * 1024 * 1024) {
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size > max)
    throw new Error("所选文件类型或大小超限");
  return fs.readFile(file);
}
async function invoke(
  action: string,
  input: unknown,
  operation: string,
): Promise<unknown> {
  await initialized;
  if (action === "diagnostics") {
    const redacted = JSON.stringify(
      {
        appVersion: workerData.version,
        platform: process.platform,
        arch: process.arch,
        config: store.config,
        journals: await transactions.journals(),
        logs: await store.logs(true),
        startupError: startupError ? String(startupError) : null,
      },
      null,
      2,
    ).replaceAll(os.homedir(), "<用户目录>");
    return new Uint8Array(
      zipSync(
        {
          "diagnostics.json": strToU8(redacted),
          "README.txt": strToU8(
            "戍声诊断记录。包含配置、事务、摘要和日志；不包含音频、游戏账号凭证及 ADB 私钥。",
          ),
        },
        { level: 6 },
      ),
    );
  }
  if (action === "config.repair") {
    const original = await fs.readFile(store.file("config.json"));
    await fs.writeFile(
      store.file("config.corrupt." + Date.now() + ".json"),
      original,
      { flag: "wx" },
    );
    await store.saveConfig(defaultConfig);
    startupError = undefined;
    await store.log("warn", operation, "config.repaired");
    return state();
  }
  if (startupError)
    throw new Error(
      "配置读取失败，请导出诊断后使用“备份并重建配置”。原配置已保留。",
      { cause: startupError },
    );
  switch (action) {
    case "state":
      return state();
    case "config.save": {
      const previous = store.config;
      const next = configSchema.parse(input);
      await store.saveConfig(next);
      if (previous.theme !== next.theme || previous.accent !== next.accent)
        await store.log("info", operation, "theme.changed", {
          from: { theme: previous.theme, accent: previous.accent },
          to: { theme: next.theme, accent: next.accent },
        });
      return state();
    }
    case "discover.local":
      return discoverLocal(store);
    case "discover.folder": {
      const folder = z.string().min(1).max(2048).parse(input);
      return (await findRoots(folder, store)).map((root) => ({
        id: randomUUID(),
        kind: "local",
        root,
        label:
          "明日方舟 · " + (process.platform === "darwin" ? "macOS" : "Windows"),
      }));
    }
    case "discover.devices":
      return listDevices();
    case "discover.adb":
      return discoverAdb(locationSchema.parse(input), store);
    case "location.select": {
      const location = locationSchema.parse(input),
        t = await transport(location, store);
      try {
        await readManifest(t);
      } finally {
        await t.close();
      }
      const existing = store.config.locations.find(
        (x) =>
          x.kind === location.kind &&
          x.root === location.root &&
          x.serial === location.serial,
      );
      if (existing) location.id = existing.id;
      await store.saveConfig({
        ...store.config,
        locations: [
          ...store.config.locations.filter((x) => x.id !== location.id),
          location,
        ],
        selected: location.id,
      });
      return state();
    }
    case "scan":
      return withGame((t) =>
        scan(t, new Set(), store, operation).then(async (result) => {
          const managed = await transactions.managedHashes();
          for (const b of result.bundles)
            if (b.status === "changed" && managed.has(b.sha256))
              b.status = "managed";
          return result;
        }),
      );
    case "preview.clip": {
      const p = z
        .object({
          bundle: safeRelative,
          clip: z.string(),
          original: z.boolean(),
        })
        .parse(input);
      if (!targetBundle(p.bundle))
        throw new Error("试听资源不在卫戍协议范围内");
      return withGame(async (t) => {
        const bundle = readBundle(
          p.original
            ? await transactions.baseline(t, p.bundle)
            : await t.read(p.bundle),
        );
        const clip = audioClips(bundle).find((c) => c.name === p.clip);
        if (!clip) throw new Error("语音不存在");
        return preview(payload(bundle, clip));
      });
    }
    case "preview.entry": {
      const entry = entrySchema.parse(input);
      if (entry.kind === "audio")
        return preview(await store.readBlob(entry.blob!));
      if (entry.kind === "silence")
        return preview(encodeIma(new Int16Array(2400), 24000));
      return withGame(async (t) => {
        const bundle = readBundle(
            await transactions.baseline(t, entry.donorBundle!),
          ),
          clip = audioClips(bundle).find((c) => c.name === entry.donorClip);
        if (!clip) throw new Error("引用语音不存在");
        return preview(payload(bundle, clip));
      });
    }
    case "audio.encode": {
      const p = z
        .object({
          pcm: z.instanceof(Uint8Array),
          rate: z.number().int(),
          encoding: z.enum(["ima", "pcm"]).default("ima"),
          channels: z.union([z.literal(1), z.literal(2)]).default(1),
        })
        .parse(input);
      return encodeAudio(p.pcm, p.rate, store, p.encoding, p.channels);
    }
    case "pack.new":
      return newPack(store.config.author);
    case "pack.save": {
      const pack = packSchema.parse(input);
      for (const e of pack.entries)
        if (e.kind === "audio") await store.readBlob(e.blob!);
      return store.savePack(pack);
    }
    case "pack.importFile":
      return importPack(await boundedRead(z.string().parse(input)), store);
    case "pack.export":
      return new Uint8Array(
        await exportPack(await store.pack(z.string().parse(input)), store),
      );
    case "pack.importBundle": {
      const p = z
        .object({ file: z.string(), target: safeRelative })
        .parse(input);
      return entriesFromBundle(await boundedRead(p.file), p.target, store);
    }
    case "plan": {
      const p = z
        .object({
          key: z.string(),
          mode: z.enum(["exact", "variable"]),
          timing: z.enum(["closed", "hot"]),
        })
        .parse(input);
      return withGame(async (t) =>
        transactions.prepare(t, await store.pack(p.key), p.mode, p.timing),
      );
    }
    case "apply":
      return transactions.apply(z.string().uuid().parse(input));
    case "restore":
      return transactions.restore(z.string().uuid().parse(input));
    case "logs":
      return store.logs();
    default:
      throw new Error("未知操作：" + action);
  }
}
let queue = Promise.resolve();
parentPort!.on(
  "message",
  (message: { id: string; action: string; input: unknown }) => {
    queue = queue.then(async () => {
      const operation = randomUUID();
      try {
        await initialized;
        if (
          !["state", "logs", "preview.clip", "preview.entry"].includes(
            message.action,
          )
        )
          await store.log("info", operation, "operation.start", {
            action: message.action,
          });
        const data = await invoke(message.action, message.input, operation);
        parentPort!.postMessage({
          type: "response",
          id: message.id,
          result: { ok: true, data },
        });
      } catch (error) {
        let details =
          error instanceof Error
            ? (error.stack ?? error.message)
            : String(error);
        if (error instanceof Error && error.cause)
          details += "\nCause: " + String(error.cause);
        try {
          await store.log("error", operation, "operation.failed", {
            action: message.action,
            details,
          });
        } catch (logError) {
          details += "\n日志写入失败：" + String(logError);
        }
        parentPort!.postMessage({
          type: "response",
          id: message.id,
          result: {
            ok: false,
            error: {
              message: error instanceof Error ? error.message : String(error),
              operation,
              details,
            },
          },
        });
      }
    });
  },
);
