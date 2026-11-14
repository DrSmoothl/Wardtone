import { expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Store } from "../src/core/storage";
import { configSchema, defaultConfig } from "../src/shared/model";
import { themeIds } from "../src/shared/themes";

it("migrates appearance preferences once with the original config and log preserved", async () => {
  const store = new Store(path.resolve(".test-runs/config", randomUUID()));
  await fs.mkdir(store.root, { recursive: true });
  const old = {
    ...defaultConfig,
    schema: 1,
    theme: "dark",
    accent: "rose",
    author: "测试作者",
    replacementMode: "variable",
  };
  const bytes = JSON.stringify(old);
  await fs.writeFile(store.file("config.json"), bytes);
  await store.init();
  expect(store.config).toMatchObject({
    schema: 3,
    theme: "closure",
    accent: "graphite",
    author: "测试作者",
    replacementMode: "variable",
  });
  const backups = (await fs.readdir(store.root)).filter((x) =>
    x.startsWith("config-v1-"),
  );
  expect(backups).toHaveLength(1);
  expect(await fs.readFile(store.file(backups[0]), "utf8")).toBe(bytes);
  expect((await store.logs()).map((x) => x.event)).toContain("config.migrated");
  await new Store(store.root).init();
  expect(
    (await fs.readdir(store.root)).filter((x) => x.startsWith("config-v1-")),
  ).toEqual(backups);
});
it("migrates v2 to the default terminal without losing connections or preferences", async () => {
  const store = new Store(path.resolve(".test-runs/config", randomUUID()));
  await fs.mkdir(store.root, { recursive: true });
  const old = {
    ...defaultConfig,
    schema: 2,
    theme: "system",
    accent: "orange",
    zoom: 1.25,
    motion: false,
    author: "作者",
    replacementTiming: "hot",
    selected: "game",
    locations: [
      { id: "game", kind: "local", root: "/test/game", label: "测试资源" },
    ],
  };
  const bytes = JSON.stringify(old);
  await fs.writeFile(store.file("config.json"), bytes);
  await store.init();
  expect(store.config).toEqual({ ...old, schema: 3, theme: "closure" });
  const backups = (await fs.readdir(store.root)).filter((file) =>
    file.startsWith("config-v2-"),
  );
  expect(backups).toHaveLength(1);
  expect(await fs.readFile(store.file(backups[0]), "utf8")).toBe(bytes);
  expect((await store.logs()).at(-1)).toMatchObject({
    event: "config.migrated",
    detail: { from: 2, to: 3 },
  });
});
it.each(themeIds)(
  "keeps the selected %s theme after restart",
  async (theme) => {
    const store = new Store(path.resolve(".test-runs/config", randomUUID()));
    await store.init();
    await store.saveConfig({ ...defaultConfig, theme, accent: "green" });
    const restarted = new Store(store.root);
    await restarted.init();
    expect(restarted.config).toEqual({
      ...defaultConfig,
      theme,
      accent: "green",
    });
    expect(
      (await fs.readdir(store.root)).filter((file) =>
        file.startsWith("config-v"),
      ),
    ).toHaveLength(0);
  },
);
it("rejects an unknown theme instead of silently choosing another one", () => {
  expect(() =>
    configSchema.parse({ ...defaultConfig, theme: "missing-theme" }),
  ).toThrow();
});
it("rejects an invalid legacy config without overwriting it", async () => {
  const store = new Store(path.resolve(".test-runs/config", randomUUID()));
  await fs.mkdir(store.root, { recursive: true });
  const bytes = JSON.stringify({
    ...defaultConfig,
    schema: 1,
    accent: "unknown",
  });
  await fs.writeFile(store.file("config.json"), bytes);
  await expect(store.init()).rejects.toThrow();
  expect(await fs.readFile(store.file("config.json"), "utf8")).toBe(bytes);
});
