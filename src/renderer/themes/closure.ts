import sceneAsset from "./assets/closure-landscape.png";
import objectAsset from "./assets/closure-monitors.png";
import frameAsset from "./assets/closure-window.png";
import controlAsset from "./assets/closure-refresh.png";
import indicatorAsset from "./assets/closure-cube.png";
import cardAsset from "./assets/closure-ready.png";
import stickerAsset from "./assets/closure-sticker.png";
import floorAsset from "./assets/closure-floor.png";
import backdrop from "./assets/closure-backdrop.png";
import emblem from "./assets/closure-emblem.png";
import { palette } from "./palette";
import { surfaces, asset, type ThemeSpec } from "./types";

export const closure: ThemeSpec = {
  chrome: "arcade",
  headline: ["声音实验室", "现在开机。"],
  backdrop,
  emblem,
  tokens: () => ({
    ...surfaces(palette(true, 286, 0.17, 0.035)),
    bg: "oklch(.155 .035 285)",
    "bg-side": "oklch(.125 .04 285)",
    surface: "oklch(.205 .04 283)",
    "surface-pop": "oklch(.25 .055 285)",
    fill: "oklch(.26 .055 284)",
    "fill-2": "oklch(.32 .07 285)",
    line: "oklch(.34 .085 286)",
    "line-2": "oklch(.48 .12 285)",
    accent: "oklch(.74 .17 286)",
    "accent-2": "oklch(.81 .13 286)",
    "accent-soft": "oklch(.32 .11 282)",
    "accent-ink": "oklch(.9 .08 283)",
    "fg-2": "oklch(.81 .035 286)",
    "fg-3": "oklch(.67 .05 286)",
    action: "oklch(.73 .19 349)",
    "action-hover": "oklch(.8 .15 349)",
    "on-action": "oklch(.17 .04 335)",
    signal: "oklch(.88 .14 191)",
    "signal-soft": "oklch(.27 .055 205)",
    "decor-ink": "oklch(.88 .16 91)",
    ring: "oklch(.88 .14 191 / .6)",
    "font-display": '"Chakra Petch", var(--font-mono)',
    "font-heading": '"Smiley Sans", var(--font)',
    "radius-xs": "2px",
    "radius-sm": "3px",
    "radius-md": "4px",
    "radius-lg": "6px",
    "radius-xl": "8px",
    "frame-width": "2px",
    "sidebar-width": "100%",
    "header-height": "86px",
    "theme-backdrop": asset(backdrop),
    "theme-emblem": asset(emblem),
    "theme-texture":
      "repeating-linear-gradient(0deg, transparent 0 3px, oklch(.7 .1 280 / .025) 3px 4px)",
    "theme-wash":
      "radial-gradient(ellipse at 100% 0, oklch(.5 .2 290 / .22), transparent 65%)",
    "theme-scene": asset(sceneAsset),
    "theme-object": asset(objectAsset),
    "theme-frame": asset(frameAsset),
    "theme-control": asset(controlAsset),
    "theme-indicator": asset(indicatorAsset),
    "theme-card": asset(cardAsset),
    "theme-sticker": asset(stickerAsset),
    "theme-floor": asset(floorAsset),
    "art-opacity": ".95",
  }),
};
