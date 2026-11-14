import banks from "./cue-data/banks.json";
import voiceRules from "./cue-data/voice-rules.json";
import voiceLines from "./cue-data/voice-lines.json";
import catalog from "./cue-data/catalog.json";
import { signalFacts } from "./cue-facts";
import { musicCatalog, musicPlayback } from "./music";

export const cueEvidenceVersion = "明日方舟 2.7.91 · V079 · 2026-11-14";
export type ClipCue = {
  title: string;
  kind:
    | "人声播报"
    | "终端提示音"
    | "界面音效"
    | "战斗音效"
    | "背景音乐"
    | "未引用资源";
  trigger: string;
  playback: string[];
  signals: string[];
  sources: string[];
  status: "configured" | "unreferenced" | "trigger-unresolved";
  probability?: number;
  cooldown?: number;
  tableCooldown?: number;
  priority?: number;
  alternatives?: string[];
};

const voiceConditions: Record<number, string> = {
  35: "模拟开始动画触发播报时。",
  36: "当前终端归属于自己、进入非领袖回合整备时，连续未损失生命的作战达到 3 回合。",
  37: "当前终端归属于自己、进入非领袖回合整备时，连续损失生命的作战达到 3 回合。",
  38: "当前终端归属于自己，回合开始面板进入普通领袖回合时。",
  39: "当前终端归属于自己，回合开始面板进入隐秘领袖回合时。",
  40: "商店刷新序号变化后，存在非空、属于干员且带有可合成标记的商品槽位。",
  41: "购买干员后，购买等级为 1–4。",
  42: "购买干员后，购买等级至少为 5。",
  43: "调度中心等级上升时。",
  44: "普通或特殊整备阶段显示倒计时，并首次进入剩余 10 秒的紧急提示状态时。",
  45: "收到金色干员晋升广播，且广播玩家与当前观看玩家一致、当前终端归属于自己时，在下一次语音条件检查中消费该事件。",
  46: "盟约永久层数跨过尚未播报的 100、300、500 层阈值时；不含临时层数，初次载入已有层数不补播。",
  47: "商店冻结状态从未冻结变为冻结时。解冻不触发。",
};

const voiceChannel =
  "共用播报声道；新播报打断旧播报，交叉淡化约 0.1 秒。普通音效可同时播放。";
const independentSfx =
  "普通音效使用独立声部，可与人声及其他音效叠加；不会等待上一条播报结束。";
const stylizedSignals = new Set(
  banks
    .filter((bank) => bank.signal.endsWith("_AC_S_CLOSUR"))
    .map((bank) => bank.signal.replace(/_AC_S_CLOSUR$/, "")),
);

function voiceCue(bundle: string, clip: string): ClipCue | undefined {
  const closure =
    /^audio\/sound_beta_\d+\/voice(?:_[^/]+)?\/ac_s_closur\.ab$/.test(bundle);
  const iron = bundle === "audio/autochess_skin_se/ac_n_iron.ab";
  if (!closure && !iron) return undefined;
  const line = voiceLines.find((item) => item.clip === clip);
  if (!line) return undefined;
  const rule = voiceRules.find((item) => item.trigger === line.showType);
  if (!rule) throw new Error("语音用途缺少触发规则：" + clip);
  const trigger = voiceConditions[line.showType];
  if (!trigger) throw new Error("语音用途缺少触发条件：" + line.showType);
  const alternatives = voiceLines
    .filter((item) => item.showType === line.showType)
    .map((item) => item.clip);
  const stateCheck = line.showType >= 40 && line.showType !== 44;
  const playback = [
    "当前终端必须归属于自己；查看其他玩家终端时不触发这组播报。",
    alternatives.length > 1
      ? `同一终端、同一语言的 ${alternatives.join(" / ")} 随机播放一条。`
      : "该触发组只有这一条资源。",
    voiceChannel,
  ];
  if (stateCheck)
    playback.push(
      "同一次状态检查命中多个触发组时，按优先级取一个；数字越小越优先，同值保留先遇到者。该组概率未命中时，不改播较低优先级语音。",
    );
  if (line.showType === 36 || line.showType === 37)
    playback.push(
      "表内冷却为 200 秒；当前回合开始调用路径不执行这套冷却检查。领袖回合优先走领袖播报。",
    );
  if (closure)
    playback.push("由游戏当前语音语言选择中文或日语包，两种语言不会同时播放。");
  else
    playback.push(
      "乌萨斯的 CN 编号是终端提示音，通过音效系统送入播报声道，与可露希尔人声使用相同用途分组。",
    );
  return {
    title: line.title,
    kind: closure ? "人声播报" : "终端提示音",
    trigger,
    playback,
    signals: iron
      ? [rule.key, "battle.ON_AC_SKIN_SE.ac_n_iron." + clip.toLowerCase()]
      : [rule.key, "ac_s_closur/" + clip],
    sources: [
      closure
        ? "charword_table.charWords：ac_s_closur_" + clip
        : "activity_table.autoChessData.skinSoundPreviewDict.ac_n_iron",
      "activity_table.autoChessData.skinVoiceTriggerDataDict",
      "act3autochess / V3_1：连续回合 3；盟约阈值 100 / 300 / 500；整备紧急提示 10 秒",
    ],
    status: "configured",
    probability: rule.probability,
    cooldown: stateCheck ? rule.cd : 0,
    tableCooldown: rule.cd,
    priority: stateCheck ? rule.priority : undefined,
    alternatives,
  };
}

const unreferenced: Record<string, Pick<ClipCue, "title" | "trigger">> = {
  autochess_a_bat_enrylmchfr: {
    title: "激光装置发射 · 公共包副本",
    trigger:
      "当前完整 audio_data 音效表未引用此副本。激光装置攻击事件指向活动包中的 act1autochess_a_bat_enrylmchfr；两者编码音频相同。",
  },
  autochess_a_bat_enrylmcht: {
    title: "激光命中 · 公共包副本",
    trigger:
      "当前完整 audio_data 音效表未引用此副本。激光弹体命中事件指向活动包中的 act1autochess_a_bat_enrylmcht；两者编码音频相同。",
  },
  autochess_g_ui_load: {
    title: "活动载入 · 当前未引用",
    trigger:
      "当前完整 audio_data 音效表及已核对的卫戍界面预制体未引用此资源。当前活动入口使用 autochess_b_ui_load_3。",
  },
};

export function getClipCue(bundle: string, clip: string): ClipCue | undefined {
  const music = musicCatalog.find(
    (item) => item.bundle === bundle && item.clip === clip,
  );
  if (music)
    return {
      title: music.title,
      kind: "背景音乐",
      trigger: music.trigger,
      playback: musicPlayback,
      signals: [music.signal],
      sources: [
        "audio_data.bgmBanks：loop 资源绑定、volume=1、crossfade=1、delay=0；当前四首无 intro",
        "本机 V079 资源清单及对应 AudioClip",
      ],
      status: "configured",
    };
  if (!(catalog as Record<string, string[]>)[bundle]?.includes(clip))
    return undefined;
  const voice = voiceCue(bundle, clip);
  if (voice) return voice;
  const publicBundle = /^audio\/persist_se\/persist_se_\d+\.ab$/.test(bundle);
  const activityBundle = /^audio\/custom_se\/act\d+autochess\.ab$/.test(bundle);
  if (!publicBundle && !activityBundle) return undefined;
  if (publicBundle && unreferenced[clip]) {
    return {
      ...unreferenced[clip],
      kind: "未引用资源",
      status: "unreferenced",
      playback: [
        "保留用于资源核对；修改此条不能据此认定当前玩法中的对应声音会改变。",
      ],
      signals: [],
      sources: [
        "完整 audio_data：13,860 个 SoundFXBank；卫戍模式预制体与动画事件；音频载荷摘要对比",
      ],
    };
  }
  const matches = banks.filter((bank) => {
    if (bank.asset.split("/").at(-1) !== clip) return false;
    return activityBundle
      ? bank.asset.includes("/CustomSE/act")
      : !bank.asset.includes("/CustomSE/act") &&
          !bank.asset.includes("/AutoChessSkinSE/");
  });
  if (!matches.length) return undefined;
  const first = matches[0];
  const styled = first.signal.endsWith("_AC_S_CLOSUR");
  const baseSignal = first.signal.replace(/_AC_S_CLOSUR$/, "");
  const key = baseSignal.replace(/^(?:ui|battle)\.ON_AUTOCHESS_/, "");
  let fact = signalFacts[key];
  if (activityBundle) {
    if (
      ![
        "act1autochess_a_bat_enrylmchfr",
        "act1autochess_a_bat_enrylmcht",
      ].includes(clip)
    )
      return undefined;
    fact =
      clip === "act1autochess_a_bat_enrylmchfr"
        ? {
            title: "激光装置发射",
            trigger: "激光装置 trap_1104_aclasert 的 attack.0 能力启动时。",
          }
        : {
            title: "激光弹体命中",
            trigger:
              "激光弹体 projectile_trap_aclasert 命中目标时。发射与命中是两个独立事件。",
          };
  }
  if (!fact) throw new Error("音效信号缺少用途说明：" + first.signal);
  const playback = [
    first.alternatives === 1
      ? "每次触发该音效组播放这一条。"
      : `该组有 ${first.alternatives} 个候选，每次按权重选择一个。`,
    independentSfx,
    first.maxVoices > 0
      ? `同一音效组最多同时 ${first.maxVoices} 个声部；再次触发时${first.replaceOldest ? "停止最旧声部" : "跳过新声音"}。`
      : "该音效组未设置并发数量上限。",
  ];
  if (styled)
    playback.push(
      "使用可露希尔终端的对应界面时替代普通版；同一处提示只选择一个版本。",
    );
  else if (stylizedSignals.has(first.signal))
    playback.push(
      "普通终端使用此版；可露希尔终端的对应界面选择专属版，同一处提示只选择一个版本。",
    );
  if (first.delay > 0) playback.push(`配置起播延迟 ${first.delay} 秒。`);
  return {
    title: fact.title + (styled ? " · 可露希尔" : ""),
    kind: first.signal.startsWith("battle.") ? "战斗音效" : "界面音效",
    trigger: fact.trigger,
    playback,
    signals: matches.map((bank) => bank.signal),
    sources: ["audio_data.soundFXBanks：资源绑定、延迟、并发设置"],
    status: key === "ENTER_DANGER" ? "trigger-unresolved" : "configured",
  };
}

export function cueSearchText(bundle: string, clip: string): string {
  const cue = getClipCue(bundle, clip);
  return cue
    ? [cue.title, cue.kind, cue.trigger, ...cue.signals].join(" ")
    : "用途待核对";
}

export const playbackOverview = [
  "初始终端没有独立 CN 语音包，使用公共界面与战斗音效。可露希尔有中文、日语各 19 条；乌萨斯有 19 条终端提示音。",
  "同一角色触发组随机选择一条。可露希尔与乌萨斯共用播报声道，新播报会用约 0.1 秒交叉淡化替换旧播报。",
  "普通音效可相互叠加，也可与播报同时播放。一项游戏操作能先后派发多个声音事件，因此可能听到提示音、操作音和人声一起播放。",
  "背景音乐单列为四首循环曲目：活动主界面、整备、领袖作战、隐秘领袖；可与终端播报和公共音效同时播放。",
  "当前已配置的 88 个相关音效组，每组均只绑定一个音频候选。同一处可露希尔专属版与普通版互斥；每组并发上限在条目中列出。",
  "播放时机按当前游戏版本整理；概率、连续回合条件和冷却在每条右侧的信息按钮中查看。尚未确定的触发条件会单独标注。",
] as const;
