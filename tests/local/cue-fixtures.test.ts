import { expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { audioClips, readBundle } from "../../src/core/unity";
import { targetClip } from "../../src/core/game";
import { getClipCue } from "../../src/shared/cues";
import catalog from "../../src/shared/cue-data/catalog.json";

it("matches every catalog identity against the real game resource copies", async () => {
  const source = path.resolve(
    process.env.WARDTONE_FIXTURE ?? ".fixtures/Bundles",
  );
  for (const [bundle, expected] of Object.entries(catalog)) {
    const bytes = await fs.readFile(path.join(source, bundle));
    const clips = audioClips(readBundle(bytes))
      .filter((clip) => targetClip(bundle, clip.name))
      .map((clip) => clip.name);
    expect(clips.sort(), bundle).toEqual([...expected].sort());
    for (const clip of clips) expect(getClipCue(bundle, clip)).toBeDefined();
  }
});
