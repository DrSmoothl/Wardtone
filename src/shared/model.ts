import { z } from "zod";
import { accents, defaultTheme, themeIds } from "./themes";

export const modes = ["exact", "variable"] as const;
export const locationSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(120),
  kind: z.enum(["local", "adb"]),
  root: z.string().min(1).max(2048),
  serial: z.string().max(200).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  connection: z.enum(["server", "direct"]).optional(),
});
export type Location = z.infer<typeof locationSchema>;
export const configSchema = z.object({
  schema: z.literal(3),
  replacementMode: z.enum(["exact", "variable"]).default("exact"),
  replacementTiming: z.enum(["closed", "hot"]).default("closed"),
  locations: z.array(locationSchema),
  selected: z.string().nullable(),
  theme: z.enum(themeIds),
  accent: z.enum(accents),
  zoom: z.union([z.literal(1), z.literal(1.12), z.literal(1.25)]),
  motion: z.boolean(),
  author: z.string().max(100),
});
export type Config = z.infer<typeof configSchema>;
export const defaultConfig: Config = {
  schema: 3,
  replacementMode: "exact",
  replacementTiming: "closed",
  locations: [],
  selected: null,
  theme: defaultTheme,
  accent: "blue",
  zoom: 1,
  motion: true,
  author: "",
};
export const safeRelative = z
  .string()
  .min(1)
  .max(512)
  .refine(
    (s) =>
      !s.includes("\\") &&
      !s.includes("\0") &&
      !s.includes(":") &&
      !s.startsWith("/") &&
      s.split("/").every((p) => p.length > 0 && p !== "." && p !== ".."),
    "资源路径无效",
  );
export const entrySchema = z
  .object({
    bundle: safeRelative,
    clip: z.string().min(1).max(128),
    kind: z.enum(["audio", "reference", "silence"]),
    blob: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    donorBundle: safeRelative.optional(),
    donorClip: z.string().min(1).max(128).optional(),
  })
  .superRefine((e, c) => {
    if (e.kind === "audio" && !e.blob)
      c.addIssue({ code: "custom", message: "缺少音频内容" });
    if (e.kind === "reference" && (!e.donorBundle || !e.donorClip))
      c.addIssue({ code: "custom", message: "缺少引用语音" });
  });
export type PackEntry = z.infer<typeof entrySchema>;
export const packSchema = z
  .object({
    schema: z.literal(1),
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    version: z
      .string()
      .max(40)
      .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    author: z.string().trim().min(1).max(100),
    description: z.string().max(4000),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    entries: z.array(entrySchema).max(1000),
  })
  .superRefine((p, c) => {
    const keys = p.entries.map((e) => e.bundle + "#" + e.clip);
    if (new Set(keys).size !== keys.length)
      c.addIssue({ code: "custom", message: "存在重复目标语音" });
  });
export type VoicePack = z.infer<typeof packSchema>;
export const packKey = (pack: VoicePack) => pack.id + "@" + pack.version;
export type ClipView = {
  name: string;
  event: string;
  duration: number;
  rate: number;
  channels: number;
  bytes: number;
  codec: number;
};
export type BundleView = {
  path: string;
  label: string;
  language: string;
  bytes: number;
  expectedBytes: number;
  sha256: string;
  md5: string;
  expectedMd5: string;
  status: "official" | "managed" | "changed" | "missing";
  clips: ClipView[];
};
export type Inventory = {
  location: Location;
  version: string;
  manifestSha: string;
  bundles: BundleView[];
  warnings: string[];
};
export type LogLine = {
  time: string;
  level: "info" | "warn" | "error";
  operation: string;
  event: string;
  detail: unknown;
};
export type PlanView = {
  id: string;
  pack: string;
  mode: "exact" | "variable";
  timing: "closed" | "hot";
  files: {
    path: string;
    before: number;
    after: number;
    beforeHash: string;
    afterHash: string;
    unchanged: boolean;
  }[];
  warnings: string[];
  unchanged: boolean;
};
export type JournalView = {
  id: string;
  time: string;
  pack: string;
  location: string;
  status: string;
  files: number;
  error?: string;
};
export type AppState = {
  config: Config;
  packs: VoicePack[];
  journals: JournalView[];
  platform: string;
  version: string;
  dataPath: string;
};
export type ApiResult<T = unknown> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { message: string; operation: string; details: string };
    };
export interface DesktopApi {
  invoke<T = unknown>(action: string, input?: unknown): Promise<T>;
  onProgress(callback: (line: LogLine) => void): () => void;
  onCloseRequested(callback: () => void): () => void;
}
declare global {
  interface Window {
    desktop: DesktopApi;
  }
}
