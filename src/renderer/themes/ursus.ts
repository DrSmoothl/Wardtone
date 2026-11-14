import sceneAsset from "./assets/ursus-flags.png";
import objectAsset from "./assets/ursus-poster.png";
import frameAsset from "./assets/ursus-gauge.png";
import controlAsset from "./assets/ursus-refresh.png";
import indicatorAsset from "./assets/ursus-dial.png";
import cardAsset from "./assets/ursus-emblem.png";
import stickerAsset from "./assets/ursus-sash.png";
import backdrop from "./assets/ursus-backdrop.png";
import emblem from "./assets/ursus-emblem.png";
import { palette } from "./palette";
import { surfaces, asset, type ThemeSpec } from "./types";

export const ursus: ThemeSpec = {
  chrome: "industrial",
  headline: ["让每个声音", "响彻终端。"],
  backdrop,
  emblem,
  tokens: () => ({
    ...surfaces(palette(false, 67, 0.12, 0.014)),
    bg: "oklch(.84 .025 85)",
    "bg-side": "oklch(.9 .023 85)",
    surface: "oklch(.92 .025 85)",
    "surface-pop": "oklch(.96 .019 85)",
    fill: "oklch(.86 .029 85)",
    "fill-2": "oklch(.78 .035 85)",
    line: "oklch(.68 .035 75)",
    "line-2": "oklch(.46 .034 65)",
    fg: "oklch(.24 .02 195)",
    "fg-2": "oklch(.36 .025 195)",
    "fg-3": "oklch(.45 .025 195)",
    accent: "oklch(.51 .16 38)",
    "accent-2": "oklch(.44 .15 38)",
    "accent-soft": "oklch(.84 .07 70)",
    "accent-ink": "oklch(.39 .12 38)",
    action: "oklch(.24 .035 195)",
    "action-hover": "oklch(.31 .045 195)",
    "on-action": "oklch(.95 .025 85)",
    signal: "oklch(.37 .055 185)",
    "signal-soft": "oklch(.85 .035 185)",
    "decor-ink": "oklch(.55 .19 35)",
    "rail-bg": "oklch(.24 .03 195)",
    "rail-ink": "oklch(.93 .025 85)",
    "rail-signal": "oklch(.84 .13 80)",
    "font-display": '"Barlow Condensed", var(--font-mono)',
    "radius-xs": "1px",
    "radius-sm": "2px",
    "radius-md": "2px",
    "radius-lg": "2px",
    "radius-xl": "4px",
    "frame-width": "2px",
    "sidebar-width": "216px",
    "header-height": "100px",
    "theme-backdrop": asset(backdrop),
    "theme-emblem": asset(emblem),
    "theme-texture":
      "repeating-linear-gradient(135deg, oklch(.8 .03 80 / .018) 0 1px, transparent 1px 5px)",
    "theme-wash":
      "radial-gradient(ellipse at 100% 0, oklch(.5 .12 40 / .15), transparent 60%)",
    "theme-scene": asset(sceneAsset),
    "theme-object": asset(objectAsset),
    "theme-frame": asset(frameAsset),
    "theme-control": asset(controlAsset),
    "theme-indicator": asset(indicatorAsset),
    "theme-card": asset(cardAsset),
    "theme-sticker": asset(stickerAsset),
    "art-opacity": "1",
  }),
};
