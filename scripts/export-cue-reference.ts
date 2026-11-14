import fs from "node:fs/promises";
import {
  getClipCue,
  cueEvidenceVersion,
  playbackOverview,
} from "../src/shared/cues";
import catalog from "../src/shared/cue-data/catalog.json";
import voiceLines from "../src/shared/cue-data/voice-lines.json";
import { musicCatalog } from "../src/shared/music";

const cell = (text: string) =>
  text.replaceAll("|", "\\|").replaceAll("\n", " ");
const lines = [
  "# 卫戍协议音频用途",
  "",
  `核对版本：${cueEvidenceVersion}。`,
  "",
  "当前目录收录 10 个资源包、133 条音频：129 条播报与音效，以及 4 首背景音乐。三套终端共用部分界面音效；初始终端没有独立 CN 语音包。下表由应用同一份用途目录生成，语音库每条右侧的信息按钮提供相同说明。",
  "",
  "## 播放规则",
  "",
  ...playbackOverview.map((text) => "- " + text),
  "",
  "## 可露希尔与乌萨斯的 19 个编号",
  "",
  "下列用途同时适用于可露希尔中文、日语和乌萨斯提示音三个包，共 57 条。可露希尔按游戏当前语言选包；乌萨斯是终端提示音。CN_015、CN_016 不在本机当前这三个包中。概率按一次符合条件的触发机会计算，冷却单位为现实秒数。",
  "",
  "| 编号 | 用途 | 触发条件 | 概率 | 当前路径冷却 | 状态检查优先级 | 同组候选 |",
  "| --- | --- | --- | --- | --- | --- | --- |",
];
for (const line of voiceLines) {
  const cue = getClipCue(
    "audio/sound_beta_2/voice_cn/ac_s_closur.ab",
    line.clip,
  );
  if (!cue) throw new Error("缺少编号用途：" + line.clip);
  lines.push(
    `| ${line.clip} | ${cue.title} | ${cell(cue.trigger)} | ${Math.round(cue.probability! * 100)}% | ${cue.cooldown ? cue.cooldown + " 秒" : "无"} | ${cue.priority ?? "不走状态优先级"} | ${cue.alternatives!.join(" / ")} |`,
  );
}
lines.push(
  "",
  "CN_004–007 的表内冷却值为 200 秒，但当前回合开始路径不检查或启动这套冷却；表中的“无”是实际路径行为。领袖回合优先选择 CN_008 或 CN_009。状态检查先选优先级最低数值的组，再判断播放概率，概率未命中不会改试低优先级组。",
  "",
  "## 公共与活动音效",
  "",
  "普通音效默认可叠加。表中的并发数量只限制同一音效组；达到上限时，当前配置均停止最旧声部。可露希尔专属版在同一处界面提示中替代普通版。",
  "",
);
for (const [bundle, clips] of Object.entries(catalog)) {
  if (!bundle.includes("/persist_se/") && !bundle.includes("/custom_se/"))
    continue;
  lines.push(
    `### ${bundle}`,
    "",
    "| 资源 | 用途 | 什么时候播放 | 怎样播放 |",
    "| --- | --- | --- | --- |",
  );
  for (const clip of clips) {
    const cue = getClipCue(bundle, clip);
    if (!cue) throw new Error("缺少资源用途：" + bundle + "#" + clip);
    const rules = cue.playback.filter(
      (rule) =>
        !rule.startsWith("普通音效使用") && !rule.startsWith("每次触发"),
    );
    lines.push(
      `| \`${clip}\` | ${cue.title}${cue.status === "trigger-unresolved" ? "（触发点待核对）" : ""} | ${cell(cue.trigger)} | ${cell(rules.join(" "))} |`,
    );
  }
  lines.push("");
}
lines.push(
  "## 背景音乐",
  "",
  "四首都使用完整循环段，没有独立前奏；配置音量为 1、交叉淡化 1 秒、起播延迟 0。替换时选择适合循环衔接的音频，可在播放器开启循环试听。",
  "",
  "| 资源 | 用途 | 播放场景 |",
  "| --- | --- | --- |",
);
for (const music of musicCatalog)
  lines.push(`| \`${music.clip}\` | ${music.title} | ${music.trigger} |`);
lines.push(
  "",
  "## 核对依据",
  "",
  "- 本机完整热更新清单、已下载资源与安装包内置音频清单交叉比较。扫描记录见 `docs/verification.md`。",
  "- `activity_table`：终端类型、语音预览表、13 组触发规则、连续回合与层数条件、倒计时阈值、广播气泡配置。",
  "- `charword_table`：可露希尔语音编号、用途及 showType。",
  "- `audio_data`：全量 13,860 个 SoundFXBank；当前目标中的 88 组资源绑定、延迟与并发参数。",
  "- `audio_data.bgmBanks`：四首音乐的 loop、事件、音量、淡化和延迟配置。",
  "- 卫戍协议界面与动画音频事件：播放场景、终端主题和界面状态。",
  "",
  "用途说明按上述游戏版本整理；尚未确定的触发条件在对应条目中标注。",
  "",
);
await fs.writeFile("docs/playback-reference.md", lines.join("\n"));
console.log("已生成 19 个共用编号、72 条公共/活动音效及 4 首背景音乐用途表");
