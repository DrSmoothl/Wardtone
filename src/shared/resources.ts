export const isMusicBundle = (bundle: string) =>
  /^audio\/sound_beta_\d+\/music\/act\d+autochess\/[^/]+\.ab$/.test(bundle);

export type ResourceCategory = "voice" | "effects" | "music";

export function resourceCategory(bundle: string): ResourceCategory {
  if (isMusicBundle(bundle)) return "music";
  return bundle.includes("/autochess_skin_se/") ||
    /\/voice(?:_[^/]+)?\//.test(bundle)
    ? "voice"
    : "effects";
}
