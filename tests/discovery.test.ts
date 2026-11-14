import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { targetBundle, targetClip, scan, readManifest } from "../src/core/game";
import { Store } from "../src/core/storage";
import { LocalTransport } from "../src/core/local";
import { sha256 } from "../src/core/unity";

const activity = {
  name: "audio/custom_se/act1autochess.ab",
  hash: "activity-hash",
  md5: "a".repeat(32),
  abSize: 20508,
};
const voice = {
  name: "audio/sound_beta_2/voice_cn/ac_s_closur.ab",
  hash: "voice-hash",
  md5: "b".repeat(32),
  abSize: 342014,
};
const manifest = (abInfos: (typeof activity & { cid?: number })[]) => ({
  manifestName: "test.idx",
  manifestVersion: "V079",
  abInfos,
});
async function catalogFixture(
  persistent: ReturnType<typeof manifest>,
  catalog?: Record<string, unknown>,
) {
  const base = path.resolve(".test-runs/discovery");
  await fs.mkdir(base, { recursive: true });
  const root = await fs.mkdtemp(path.join(base, "catalog-"));
  const bytes = Buffer.from(JSON.stringify(persistent));
  await fs.writeFile(path.join(root, "persistent_res_list.json"), bytes);
  if (catalog)
    await fs.writeFile(
      path.join(root, "hot_update_list.json"),
      JSON.stringify({ versionId: "26-11-06-test", ...catalog }),
    );
  const store = new Store(path.join(root, "store"));
  await store.init();
  const transport = new LocalTransport({
    id: "test",
    kind: "local",
    label: "Test",
    root,
  });
  return { root, bytes, store, transport };
}

describe("autochess audio discovery", () => {
  it("includes autochess effects and music while keeping unrelated activities out", () => {
    for (const name of [
      "audio/custom_se/act1autochess.ab",
      "audio/custom_se/act3autochess.ab",
      "audio/autochess_skin_se/ac_n_iron.ab",
      "audio/sound_beta_2/voice/ac_s_closur.ab",
      "audio/sound_beta_2/voice_cn/ac_s_closur.ab",
      "audio/persist_se/persist_se_0.ab",
      "audio/sound_beta_2/music/act3autochess/m_sys_act3autochess.ab",
    ])
      expect(targetBundle(name), name).toBe(true);
    for (const name of [
      "audio/custom_se/act1multi.ab",
      "audio/custom_se/act1autochess/foreign.ab",
      "audio/sound_beta_2/music/act3side/m_sys_act3side.ab",
      "config/autochess.ab",
    ])
      expect(targetBundle(name), name).toBe(false);
    expect(
      targetClip(
        "audio/custom_se/act1autochess.ab",
        "act1autochess_a_bat_enrylmcht",
      ),
    ).toBe(true);
    expect(
      targetClip("audio/persist_se/persist_se_0.ab", "unrelated_ui_sound"),
    ).toBe(false);
  });

  it("reports a listed but undownloaded activity pack in inventory and diagnostics", async () => {
    const base = path.resolve(".test-runs/discovery");
    await fs.mkdir(base, { recursive: true });
    const root = await fs.mkdtemp(path.join(base, "missing-activity-"));
    const bundle = "audio/custom_se/act1autochess.ab";
    await fs.writeFile(
      path.join(root, "persistent_res_list.json"),
      JSON.stringify({
        manifestName: "test.idx",
        manifestVersion: "V079",
        abInfos: [
          { name: bundle, hash: "test", md5: "a".repeat(32), abSize: 20508 },
        ],
      }),
    );
    const store = new Store(path.join(root, "store"));
    await store.init();
    const location = {
      id: "test",
      kind: "local" as const,
      label: "Test",
      root,
    };
    const inventory = await scan(
      new LocalTransport(location),
      new Set(),
      store,
      "test",
    );
    expect(inventory.bundles).toHaveLength(1);
    expect(inventory.bundles[0]).toMatchObject({
      path: bundle,
      status: "missing",
      clips: [],
    });
    expect(inventory.warnings).toEqual(["缺少资源：" + bundle]);
    const logs = await store.logs();
    expect(logs.map((line) => line.event)).toEqual([
      "scan.catalog.absent",
      "scan.started",
      "scan.bundle.missing",
      "scan.cue-coverage",
      "scan.completed",
    ]);
    expect(logs.at(-1)?.detail).toMatchObject({
      candidateBundles: 1,
      missing: 1,
      clips: 0,
    });
  });

  it("finds undownloaded catalog voices without changing the persistent write manifest", async () => {
    const { bytes, store, transport } = await catalogFixture(
      manifest([activity]),
      manifest([activity, voice]),
    );
    const inventory = await scan(transport, new Set(), store, "catalog");
    expect(inventory.bundles).toHaveLength(2);
    expect(inventory.bundles[1]).toMatchObject({
      path: voice.name,
      status: "missing",
      expectedBytes: voice.abSize,
      expectedMd5: voice.md5,
      clips: [],
    });
    expect(inventory.warnings[1]).toBe(
      "尚未下载卫戍协议资源，请先在游戏中下载对应活动或语音包：" + voice.name,
    );
    expect(inventory.manifestSha).toBe(sha256(bytes));
    const canonical = await readManifest(transport);
    expect(canonical.bytes.equals(bytes)).toBe(true);
    expect(canonical.value.abInfos.map((entry) => entry.name)).toEqual([
      activity.name,
    ]);
    const logs = await store.logs();
    expect(
      logs.find((line) => line.event === "scan.catalog.loaded")?.detail,
    ).toMatchObject({ candidateBundles: 2, supplementalBundles: 1 });
    expect(logs.filter((line) => line.event === "scan.bundle.missing")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: expect.objectContaining({
            path: voice.name,
            source: "hot_update_list.json",
          }),
        }),
      ]),
    );
  });

  it("shows catalog targets when none have been registered locally", async () => {
    const { store, transport } = await catalogFixture(
      manifest([]),
      manifest([voice]),
    );
    const inventory = await scan(transport, new Set(), store, "catalog-only");
    expect(inventory.bundles).toHaveLength(1);
    expect(inventory.bundles[0]).toMatchObject({
      path: voice.name,
      status: "missing",
    });
  });

  it("preserves variable-mode size zero and ignores catalog indexing differences", async () => {
    const { store, transport } = await catalogFixture(
      manifest([{ ...activity, abSize: 0, cid: 6194 }]),
      manifest([{ ...activity, cid: 7053 }]),
    );
    const inventory = await scan(transport, new Set(), store, "variable-size");
    expect(inventory.bundles[0].expectedBytes).toBe(0);
    expect((await readManifest(transport)).value.abInfos[0].abSize).toBe(0);
  });

  it.each([
    [
      "manifest identity",
      { ...manifest([activity]), manifestName: "other.idx" },
      "版本不一致",
    ],
    [
      "manifest format",
      { ...manifest([activity]), manifestVersion: "V080" },
      "版本不一致",
    ],
    ["MD5", manifest([{ ...activity, md5: "c".repeat(32) }]), "冲突（MD5）"],
    [
      "content hash",
      manifest([{ ...activity, hash: "other-hash" }]),
      "冲突（资源 hash）",
    ],
    ["size", manifest([{ ...activity, abSize: 20509 }]), "冲突（大小）"],
    ["duplicate paths", manifest([activity, activity]), "资源名称重复"],
    ["missing local entry", manifest([]), "缺少本地卫戍资源"],
    ["short MD5", manifest([{ ...activity, md5: "aaaa" }]), "未提供完整 MD5"],
    [
      "invalid official size",
      manifest([{ ...activity, abSize: 0 }]),
      "大小无效",
    ],
  ])(
    "rejects and logs catalog conflicts: %s",
    async (_label, catalog, message) => {
      const { bytes, store, transport } = await catalogFixture(
        manifest([activity]),
        catalog,
      );
      await expect(
        scan(transport, new Set(), store, "conflict"),
      ).rejects.toThrow(message);
      const logs = await store.logs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        level: "error",
        event: "scan.catalog.failed",
      });
      expect(logs[0].detail).toMatchObject({
        error: expect.stringContaining(message),
      });
      expect(
        (await transport.read("persistent_res_list.json")).equals(bytes),
      ).toBe(true);
    },
  );

  it("logs malformed catalog JSON instead of falling back to the installed list", async () => {
    const { root, store, transport } = await catalogFixture(
      manifest([activity]),
    );
    await fs.writeFile(path.join(root, "hot_update_list.json"), "{unfinished");
    await expect(
      scan(transport, new Set(), store, "invalid-catalog"),
    ).rejects.toThrow();
    expect((await store.logs()).at(-1)).toMatchObject({
      level: "error",
      event: "scan.catalog.failed",
      detail: { error: expect.stringContaining("SyntaxError") },
    });
  });

  it("rejects and logs an existing resource that the local download manifest has not registered", async () => {
    const { root, store, transport } = await catalogFixture(
      manifest([]),
      manifest([voice]),
    );
    const resource = path.join(root, voice.name);
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "unfinished download");
    await expect(
      scan(transport, new Set(), store, "unregistered"),
    ).rejects.toThrow("资源已落盘但尚未登记到本地下载清单");
    expect((await store.logs()).at(-1)).toMatchObject({
      level: "error",
      event: "scan.bundle.unregistered",
      detail: { path: voice.name },
    });
  });
});
