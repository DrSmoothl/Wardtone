import { useLayoutEffect, useState } from "react";
import type { Config } from "../../shared/model";
import { applyTheme } from "./index";

export function useSystemDark() {
  const [dark, setDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useLayoutEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(query.matches);
    query.addEventListener("change", update);
    update();
    return () => query.removeEventListener("change", update);
  }, []);
  return dark;
}
export function useTheme(config: Config) {
  const dark = useSystemDark();
  useLayoutEffect(() => {
    applyTheme(config.theme, config.accent, dark, document.documentElement);
    document.documentElement.dataset.motion = config.motion ? "on" : "off";
  }, [config.theme, config.accent, config.motion, dark]);
}
