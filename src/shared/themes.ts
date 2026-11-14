export const themeCatalog = {
  closure: {
    name: "“全能的”可露希尔",
    edition: "CLOSURE / DEVELOPER EDITION",
    code: "01",
    appearance: "dark",
    customAccent: false,
    description:
      "蓝紫窗口、青色信号与玫红操作键。得意黑与 Chakra Petch 组成开发者终端。",
  },
  terminal: {
    name: "卫戍协议终端",
    edition: "DEFENSE / TACTICAL TERMINAL",
    code: "02",
    appearance: "dark",
    customAccent: false,
    description:
      "青绿战术屏、等高线与切角面板。Rajdhani 用于终端编号和资源读数。",
  },
  ursus: {
    name: "乌萨斯齐心团",
    edition: "URSUS / UNITED COLLECTIVE",
    code: "03",
    appearance: "light",
    customAccent: false,
    description:
      "米色金属面板、深青色机架与锈红海报。Barlow Condensed 用于工业铭牌与仪表读数。",
  },
  wardtone: {
    name: "经典",
    edition: "WARDTONE / CLASSIC",
    code: "04",
    appearance: "system",
    customAccent: true,
    description: "原有的紧凑界面，深浅跟随系统，可自行选择强调色。",
  },
} as const;

export type ThemeId = keyof typeof themeCatalog;
export const themeIds = Object.keys(themeCatalog) as [ThemeId, ...ThemeId[]];
export const defaultTheme: ThemeId = "closure";
export const accents = [
  "blue",
  "violet",
  "green",
  "orange",
  "graphite",
] as const;
export type Accent = (typeof accents)[number];
