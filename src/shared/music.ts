export const musicCatalog = [
  {
    bundle: "audio/sound_beta_2/music/act1autochess/m_bat_act1autochess.ab",
    clip: "m_bat_act1autochess_loop",
    title: "整备音乐",
    trigger:
      "局内加载整备音乐场景 act1autochess_shop，发送 GAME_READY 音乐事件时。",
    signal: "battle.ON_GAME_READY.act1autochess_shop",
  },
  {
    bundle: "audio/sound_beta_2/music/act3autochess/m_boss1_act3autochess.ab",
    clip: "m_boss1_act3autochess_loop",
    title: "领袖作战音乐",
    trigger:
      "加载 act3autochess_boss 领袖作战音乐场景，发送 GAME_READY 音乐事件时。",
    signal: "battle.ON_GAME_READY.act3autochess_boss",
  },
  {
    bundle: "audio/sound_beta_2/music/act3autochess/m_boss2_act3autochess.ab",
    clip: "m_boss2_act3autochess_loop",
    title: "隐秘领袖音乐",
    trigger:
      "加载 act3autochess_hideBoss 隐秘领袖音乐场景，发送 GAME_READY 音乐事件时。",
    signal: "battle.ON_GAME_READY.act3autochess_hideBoss",
  },
  {
    bundle: "audio/sound_beta_2/music/act3autochess/m_sys_act3autochess.ab",
    clip: "m_sys_act3autochess_loop",
    title: "活动主界面音乐",
    trigger:
      "卫戍协议 act3autochess 活动界面载入，发送 ACTIVITY_LOADED 音乐事件时。",
    signal: "sys.ON_ACTIVITY_LOADED.act3autochess",
  },
] as const;

export const musicPlayback = [
  "当前音乐配置只有循环段，没有独立前奏；每次重复播放整段替换音频。",
  "每个音乐事件绑定一首曲目，不随机选择。切换配置的交叉淡化为 1 秒、起播延迟为 0。",
  "背景音乐独立于播报和音效，可同时播放；替换音频的开头与结尾决定循环衔接。",
];
