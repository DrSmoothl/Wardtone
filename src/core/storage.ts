import * as fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { z } from "zod";
import {
  configSchema,
  defaultConfig,
  packSchema,
  packKey,
  type Config,
  type VoicePack,
  type LogLine,
} from "../shared/model";
import { sha256 } from "./unity";
import { defaultTheme } from "../shared/themes";

export function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}
export async function optionalRead(file: string): Promise<Buffer | undefined> {
  try {
    return await fs.readFile(file);
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
}
export async function atomicWrite(file: string, data: Uint8Array | string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = file + "." + randomUUID() + ".tmp";
  const handle = await fs.open(temp, "wx", 0o600);
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temp, file);
  if (process.platform !== "win32") {
    const dir = await fs.open(path.dirname(file), "r");
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
  }
}
export class Store extends EventEmitter {
  readonly root: string;
  config: Config = structuredClone(defaultConfig);
  private logQueue: Promise<void> = Promise.resolve();
  constructor(root: string) {
    super();
    this.root = root;
  }
  file(...parts: string[]) {
    return path.join(this.root, ...parts);
  }
  async init() {
    for (const dir of ["blobs", "packs", "journals", "logs"])
      await fs.mkdir(this.file(dir), { recursive: true });
    const data = await optionalRead(this.file("config.json"));
    if (!data) {
      await this.saveConfig(this.config);
      return;
    }
    const input = JSON.parse(data.toString());
    if (input?.schema === 1 || input?.schema === 2) {
      const legacy =
        input.schema === 1
          ? configSchema.extend({
              schema: z.literal(1),
              theme: z.enum(["system", "light", "dark"]),
              accent: z.enum(["blue", "violet", "green", "orange", "rose"]),
            })
          : configSchema.extend({
              schema: z.literal(2),
              theme: z.literal("system"),
            });
      const previous = legacy.parse(input);
      const next = configSchema.parse({
        ...previous,
        schema: 3,
        theme: defaultTheme,
        accent: previous.accent === "rose" ? "graphite" : previous.accent,
      });
      const backup = `config-v${previous.schema}-${Date.now()}.json`;
      await atomicWrite(this.file(backup), data);
      await this.log("info", "config-migration", "config.migrating", {
        from: previous.schema,
        to: 3,
        backup,
        theme: { from: previous.theme, to: next.theme },
        accent: { from: previous.accent, to: next.accent },
      });
      await this.saveConfig(next);
      await this.log("info", "config-migration", "config.migrated", {
        from: previous.schema,
        to: 3,
      });
    } else this.config = configSchema.parse(input);
  }
  async saveConfig(config: unknown) {
    const parsed = configSchema.parse(config);
    await atomicWrite(
      this.file("config.json"),
      JSON.stringify(parsed, null, 2),
    );
    this.config = parsed;
    return parsed;
  }
  async blob(data: Buffer) {
    const hash = sha256(data),
      file = this.file("blobs", hash);
    const existing = await optionalRead(file);
    if (existing) {
      if (sha256(existing) !== hash)
        throw new Error("备份仓库摘要损坏：" + hash);
    } else await atomicWrite(file, data);
    return hash;
  }
  async readBlob(hash: string) {
    z.string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(hash);
    const data = await fs.readFile(this.file("blobs", hash));
    if (sha256(data) !== hash) throw new Error("内容摘要不符：" + hash);
    return data;
  }
  async packs(): Promise<VoicePack[]> {
    const names = await fs.readdir(this.file("packs"));
    return Promise.all(
      names
        .filter((n) => n.endsWith(".json"))
        .map(async (n) =>
          packSchema.parse(
            JSON.parse(await fs.readFile(this.file("packs", n), "utf8")),
          ),
        ),
    );
  }
  async savePack(input: unknown) {
    const p = packSchema.parse(input);
    await atomicWrite(
      this.file("packs", packKey(p) + ".json"),
      JSON.stringify(p, null, 2),
    );
    return p;
  }
  async pack(key: string) {
    const p = (await this.packs()).find((p) => packKey(p) === key);
    if (!p) throw new Error("找不到指定版本的语音包：" + key);
    return p;
  }
  async log(
    level: LogLine["level"],
    operation: string,
    event: string,
    detail: unknown = {},
  ) {
    const line: LogLine = {
      time: new Date().toISOString(),
      level,
      operation,
      event,
      detail,
    };
    const serialized = JSON.stringify(line) + "\n";
    this.logQueue = this.logQueue.then(async () => {
      const file = this.file("logs", "current.jsonl");
      let size = 0;
      try {
        size = (await fs.stat(file)).size;
      } catch (e) {
        if (!isMissing(e)) throw e;
      }
      if (size > 4 * 1024 * 1024)
        await fs.rename(file, this.file("logs", Date.now() + ".jsonl"));
      await fs.appendFile(file, serialized, { mode: 0o600 });
      this.emit("log", line);
    });
    await this.logQueue;
  }
  async logs(all = false) {
    const names = (await fs.readdir(this.file("logs")))
      .filter((n) => n.endsWith(".jsonl"))
      .sort();
    const rows: LogLine[] = [];
    for (const n of names) {
      const data = await fs.readFile(this.file("logs", n), "utf8");
      for (const line of data.split("\n"))
        if (line) rows.push(JSON.parse(line));
    }
    return (all ? rows : rows.slice(-3000)).sort((a, b) =>
      a.time.localeCompare(b.time),
    );
  }
}
