import type { CSSProperties } from "react";
import { themeCatalog, type Accent, type ThemeId } from "../../shared/themes";
import { closure } from "./closure";
import { terminal } from "./terminal";
import { ursus } from "./ursus";
import { wardtone } from "./wardtone";
import type { ThemeSpec } from "./types";

export const themeSpecs: Record<ThemeId, ThemeSpec> = {
  closure,
  terminal,
  ursus,
  wardtone,
};
export function resolveTheme(id: ThemeId, accent: Accent, systemDark: boolean) {
  if (!Object.hasOwn(themeCatalog, id) || !Object.hasOwn(themeSpecs, id))
    throw new Error(`找不到界面主题：${String(id)}`);
  const meta = themeCatalog[id],
    spec = themeSpecs[id];
  const dark =
    meta.appearance === "system" ? systemDark : meta.appearance === "dark";
  const tokens = spec.tokens({ dark, accent });
  const style = Object.fromEntries(
    Object.entries(tokens).map(([key, value]) => [`--${key}`, value]),
  ) as CSSProperties;
  style.colorScheme = dark ? "dark" : "light";
  return { ...meta, ...spec, id, dark, tokens, style };
}
export function applyTheme(
  id: ThemeId,
  accent: Accent,
  systemDark: boolean,
  root: HTMLElement,
) {
  const theme = resolveTheme(id, accent, systemDark);
  // Every theme resolves the entire contract, so switching never retains old tokens.
  for (const [key, value] of Object.entries(theme.tokens))
    root.style.setProperty(`--${key}`, value);
  root.style.colorScheme = theme.dark ? "dark" : "light";
  root.dataset.theme = id;
  root.dataset.chrome = theme.chrome;
  root.dataset.scheme = theme.dark ? "dark" : "light";
}
