import { describe, expect, it } from "vitest";
import { getClipCue } from "../src/shared/cues";
import banks from "../src/shared/cue-data/banks.json";
import rules from "../src/shared/cue-data/voice-rules.json";
import lines from "../src/shared/cue-data/voice-lines.json";
import catalog from "../src/shared/cue-data/catalog.json";

const closureJp = "audio/sound_beta_2/voice/ac_s_closur.ab";
const closureCn = "audio/sound_beta_2/voice_cn/ac_s_closur.ab";
const iron = "audio/autochess_skin_se/ac_n_iron.ab";
const activity = "audio/custom_se/act1autochess.ab";
const public0 = "audio/persist_se/persist_se_0.ab";
const public1 = "audio/persist_se/persist_se_1.ab";
const verifiedClips = Object.entries(catalog).flatMap(([bundle, clips]) =>
  clips.map((clip) => ({ bundle, clip })),
);

describe("verified autochess cue catalog", () => {
  it("maps the 129 catalog identities to 38 human voices, 19 terminal tones and three unreferenced resources", () => {
    expect(verifiedClips).toHaveLength(129);
    const cues = verifiedClips.map(({ bundle, clip }) => {
      const cue = getClipCue(bundle, clip);
      expect(cue, `${bundle}#${clip}`).toBeDefined();
      expect(cue?.title).toBeTruthy();
      expect(cue?.trigger).toBeTruthy();
      expect(cue?.sources.length).toBeGreaterThan(0);
      return cue!;
    });
    expect(cues.filter((cue) => cue.kind === "人声播报")).toHaveLength(38);
    expect(cues.filter((cue) => cue.kind === "终端提示音")).toHaveLength(19);
    expect(cues.filter((cue) => cue.status === "unreferenced")).toHaveLength(3);
    expect(cues.filter((cue) => cue.status !== "unreferenced")).toHaveLength(
      126,
    );
  });

  it("preserves the 19 voice identifiers and their 13 configured trigger groups", () => {
    const groups: Record<number, string[]> = {
      35: ["CN_001", "CN_002", "CN_003"],
      36: ["CN_004", "CN_005"],
      37: ["CN_006", "CN_007"],
      38: ["CN_008"],
      39: ["CN_009"],
      40: ["CN_010", "CN_011"],
      41: ["CN_012"],
      42: ["CN_013"],
      43: ["CN_014", "CN_017"],
      44: ["CN_018"],
      45: ["CN_019"],
      46: ["CN_020"],
      47: ["CN_021"],
    };
    expect(lines).toHaveLength(19);
    expect(rules).toHaveLength(13);
    for (const [showType, clips] of Object.entries(groups)) {
      expect(
        lines
          .filter((line) => line.showType === Number(showType))
          .map((line) => line.clip),
      ).toEqual(clips);
      const rule = rules.find((item) => item.trigger === Number(showType))!;
      for (const bundle of [closureCn, closureJp, iron])
        for (const clip of clips) {
          const cue = getClipCue(bundle, clip)!;
          expect(cue.alternatives).toEqual(clips);
          expect(cue.signals).toContain(rule.key);
          expect(cue.probability).toBe(rule.probability);
          expect(cue.tableCooldown).toBe(rule.cd);
        }
    }
  });

  it("binds each of the 88 configured sound banks to its actual clip", () => {
    expect(banks).toHaveLength(88);
    const signals = new Set<string>();
    for (const bank of banks) {
      const clip = bank.asset.split("/").at(-1)!;
      const matches = verifiedClips.filter(
        (item) => item.clip.toLowerCase() === clip.toLowerCase(),
      );
      const item = bank.asset.includes("/AutoChessSkinSE/")
        ? matches.find((item) => item.bundle === iron)
        : matches.find((item) => item.bundle !== iron);
      expect(item, bank.signal).toBeDefined();
      expect(getClipCue(item!.bundle, item!.clip)?.signals).toContain(
        bank.signal,
      );
      expect(bank.alternatives).toBe(1);
      expect(bank.loop).toBe(false);
      signals.add(bank.signal);
    }
    expect(signals.size).toBe(88);
  });

  it("describes the three unused resources only as unreferenced by the current configuration", () => {
    const rows = verifiedClips.filter(
      ({ bundle, clip }) => getClipCue(bundle, clip)?.status === "unreferenced",
    );
    expect(rows.map((item) => item.clip).sort()).toEqual([
      "autochess_a_bat_enrylmchfr",
      "autochess_a_bat_enrylmcht",
      "autochess_g_ui_load",
    ]);
    for (const { bundle, clip } of rows) {
      const cue = getClipCue(bundle, clip)!;
      expect(cue.signals).toEqual([]);
      expect(cue.trigger).toMatch(/当前.*未引用/);
      expect(cue.title + cue.trigger).not.toMatch(
        /已废弃|旧资源|永远不会|不可能播放/,
      );
    }
  });

  it.each([
    ["audio/sound_beta_2/voice_kr/ac_s_closur.ab", "CN_001"],
    ["audio/sound_beta_99/voice/ac_s_closur.ab", "CN_001"],
    ["audio/sound_beta_2/voice/ac_unknown.ab", "CN_001"],
    ["audio/autochess_skin_se/ac_n_initial.ab", "CN_001"],
    ["audio/persist_se/persist_se_99.ab", "autochess_g_ui_load"],
    ["audio/persist_se/persist_se_99.ab", "autochess_b_ui_shop_upgrade"],
    ["audio/custom_se/act3autochess.ab", "act1autochess_a_bat_enrylmchfr"],
  ])(
    "does not assign a known cue to an unverified bundle %s",
    (bundle, clip) => {
      expect(getClipCue(bundle, clip)).toBeUndefined();
    },
  );

  it("does not assign an existing public clip to a different verified bundle", () => {
    const clip = verifiedClips.find(
      (item) =>
        item.bundle === public1 && item.clip === "autochess_b_ui_shop_upgrade",
    );
    expect(clip).toBeDefined();
    expect(getClipCue(public0, clip!.clip)).toBeUndefined();
    expect(
      getClipCue(public0, "act1autochess_a_bat_enrylmchfr"),
    ).toBeUndefined();
  });

  it("leaves absent voice numbers and future clip names unmapped", () => {
    for (const bundle of [closureCn, closureJp, iron])
      for (const clip of ["CN_015", "CN_016", "CN_999", "future_voice"])
        expect(getClipCue(bundle, clip)).toBeUndefined();
    expect(getClipCue(public0, "autochess_future_unknown")).toBeUndefined();
    expect(
      getClipCue(activity, "act1autochess_future_unknown"),
    ).toBeUndefined();
  });
});
