import objectAsset from "./assets/terminal-schematic.png";
import controlAsset from "./assets/terminal-refresh.png";
import indicatorAsset from "./assets/terminal-indicator.png";
import cardAsset from "./assets/terminal-mark.png";
import stickerAsset from "./assets/terminal-radar.png";
import backdrop from "./assets/terminal-backdrop.png";
import emblem from "./assets/terminal-contours.png";
import { palette } from "./palette";
import { surfaces, asset, type ThemeSpec } from "./types";

export const terminal: ThemeSpec = {
  chrome: "tactical",
  headline: ["接管频道", "部署你的声音。"],
  backdrop,
  emblem,
  tokens: () => ({
    ...surfaces(palette(true, 173, 0.13, 0.018)),
    bg: "oklch(.16 .016 184)",
    "bg-side": "oklch(.13 .018 184)",
    surface: "oklch(.21 .02 182)",
    "surface-pop": "oklch(.25 .025 182)",
    line: "oklch(.33 .04 177)",
    "line-2": "oklch(.47 .07 173)",
    accent: "oklch(.85 .17 169)",
    "accent-2": "oklch(.91 .13 169)",
    "accent-soft": "oklch(.28 .05 174)",
    "accent-ink": "oklch(.9 .13 169)",
    "fg-2": "oklch(.79 .025 175)",
    "fg-3": "oklch(.66 .025 175)",
    action: "oklch(.85 .17 169)",
    "action-hover": "oklch(.91 .13 169)",
    "on-action": "oklch(.17 .02 176)",
    signal: "oklch(.86 .14 83)",
    "signal-soft": "oklch(.29 .04 83)",
    "decor-ink": "oklch(.9 .16 85)",
    "font-display": '"Rajdhani", var(--font-mono)',
    "radius-xs": "1px",
    "radius-sm": "2px",
    "radius-md": "2px",
    "radius-lg": "3px",
    "radius-xl": "4px",
    "sidebar-width": "96px",
    "header-height": "94px",
    "theme-backdrop": asset(backdrop),
    "theme-emblem": asset(emblem),
    "theme-texture":
      "linear-gradient(oklch(.8 .1 170 / .035) 1px, transparent 1px), linear-gradient(90deg, oklch(.8 .1 170 / .035) 1px, transparent 1px)",
    "theme-wash":
      "radial-gradient(ellipse at 100% 0, oklch(.5 .12 173 / .1), transparent 60%)",
    "theme-object": asset(objectAsset),
    "theme-control": asset(controlAsset),
    "theme-indicator": asset(indicatorAsset),
    "theme-card": asset(cardAsset),
    "theme-sticker": asset(stickerAsset),
    "art-opacity": ".9",
  }),
};
