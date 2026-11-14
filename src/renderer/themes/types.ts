import type { Accent } from "../../shared/themes";
import type { Palette } from "./palette";

export type Chrome = "quiet" | "arcade" | "tactical" | "industrial";
export type ThemeContext = { dark: boolean; accent: Accent };
export type ThemeTokens = Palette & {
  action: string;
  "action-hover": string;
  "on-action": string;
  signal: string;
  "signal-soft": string;
  "decor-ink": string;
  "font-display": string;
  "font-heading": string;
  "radius-xs": string;
  "radius-sm": string;
  "radius-md": string;
  "radius-lg": string;
  "radius-xl": string;
  "sidebar-width": string;
  "header-height": string;
  "frame-width": string;
  "theme-backdrop": string;
  "theme-emblem": string;
  "theme-texture": string;
  "theme-wash": string;
  "art-opacity": string;
  "theme-scene": string;
  "theme-object": string;
  "theme-frame": string;
  "theme-control": string;
  "theme-indicator": string;
  "theme-card": string;
  "theme-sticker": string;
  "theme-floor": string;
  "rail-bg": string;
  "rail-ink": string;
  "rail-signal": string;
};
export type ThemeSpec = {
  chrome: Chrome;
  backdrop: string | null;
  emblem: string | null;
  headline: readonly [string, string];
  tokens: (context: ThemeContext) => ThemeTokens;
};
export function surfaces(colors: Palette): ThemeTokens {
  return {
    ...colors,
    action: colors.accent,
    "action-hover": colors["accent-2"],
    "on-action": colors["on-accent"],
    signal: colors["accent-ink"],
    "signal-soft": colors["accent-soft"],
    "decor-ink": colors["fg-2"],
    "font-display": '"IBM Plex Mono", monospace',
    "font-heading": "var(--font)",
    "radius-xs": "4px",
    "radius-sm": "5px",
    "radius-md": "7px",
    "radius-lg": "10px",
    "radius-xl": "14px",
    "sidebar-width": "216px",
    "header-height": "52px",
    "frame-width": "1px",
    "theme-backdrop": "none",
    "theme-emblem": "none",
    "theme-texture": "none",
    "theme-wash": "none",
    "art-opacity": "0",
    "theme-scene": "none",
    "theme-object": "none",
    "theme-frame": "none",
    "theme-control": "none",
    "theme-indicator": "none",
    "theme-card": "none",
    "theme-sticker": "none",
    "theme-floor": "none",
    "rail-bg": colors["bg-side"],
    "rail-ink": colors.fg,
    "rail-signal": colors["accent-ink"],
  };
}
export const asset = (url: string) => `url("${url}")`;
