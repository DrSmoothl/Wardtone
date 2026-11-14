import { expect, it } from "vitest";
import { themeIds, themeCatalog } from "../src/shared/themes";
import { resolveTheme, applyTheme } from "../src/renderer/themes";

it("provides a complete, isolated token set for every theme and both system appearances", () => {
  const expected = Object.keys(
    resolveTheme("wardtone", "blue", false).tokens,
  ).sort();
  for (const theme of themeIds)
    for (const systemDark of [false, true]) {
      const result = resolveTheme(theme, "blue", systemDark);
      expect(Object.keys(result.tokens).sort()).toEqual(expected);
      expect(
        Object.values(result.tokens).every(
          (value) => value.length > 0 && !value.includes("undefined"),
        ),
      ).toBe(true);
      expect(result.dark).toBe(
        themeCatalog[theme].appearance === "system"
          ? systemDark
          : themeCatalog[theme].appearance === "dark",
      );
    }
});
it("restores classic styling after themed tokens and assets were applied", () => {
  const properties = new Map<string, string>();
  const root = {
    dataset: {},
    style: {
      setProperty: (key: string, value: string) => properties.set(key, value),
      colorScheme: "",
    },
  };
  for (const theme of themeIds)
    applyTheme(theme, "green", false, root as unknown as HTMLElement);
  const classic = resolveTheme("wardtone", "green", false);
  expect(Object.fromEntries(properties)).toEqual(
    Object.fromEntries(
      Object.entries(classic.tokens).map(([key, value]) => [`--${key}`, value]),
    ),
  );
  expect(properties.get("--theme-backdrop")).toBe("none");
  expect(properties.get("--font-heading")).toBe("var(--font)");
  expect(root.dataset).toEqual({
    theme: "wardtone",
    chrome: "quiet",
    scheme: "light",
  });
});
it("keeps terminal palettes independent of the remembered classic accent", () => {
  for (const theme of themeIds.filter((id) => id !== "wardtone"))
    expect(resolveTheme(theme, "orange", false).tokens).toEqual(
      resolveTheme(theme, "green", true).tokens,
    );
  expect(resolveTheme("wardtone", "orange", false).tokens).not.toEqual(
    resolveTheme("wardtone", "green", false).tokens,
  );
});
