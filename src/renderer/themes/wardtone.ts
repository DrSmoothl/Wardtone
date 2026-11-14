import { palette, accentColors } from "./palette";
import { surfaces, type ThemeSpec } from "./types";

export const wardtone: ThemeSpec = {
  headline: ["声音", "由你定义。"],
  chrome: "quiet",
  backdrop: null,
  emblem: null,
  tokens: ({ dark, accent }) => {
    const { hue, chroma } = accentColors[accent];
    return surfaces(palette(dark, hue, chroma));
  },
};
