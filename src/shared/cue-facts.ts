export type CueFact = { title: string; trigger: string };

// Descriptions are maintained for specific sound events and game versions.
export const signalFacts: Record<string, CueFact> = {
  SHOP_UPGRADE: {
    title: "调度中心升级",
    trigger: "调度中心升级面板播放升级动画时。",
  },
  SHOP_LOCK: {
    title: "冻结商品",
    trigger: "商店卡片进入冻结状态、播放冻结动画时。",
  },
  GETMONEY: {
    title: "调度券增加",
    trigger:
      "可用货币增加会推进货币事件序号；商店面板可见并检测到该序号更新时播放。",
  },
  EQUIP_DONE: {
    title: "装备安装",
    trigger: "完成装备拖放，或在替换装备流程中确认替换（未取消）时。",
  },
  BROADCASTHINT: {
    title: "公共消息播报",
    trigger: "顶部公共消息面板填入一条新广播时。",
  },
  CHAR_BONUS: {
    title: "干员晋升效果",
    trigger: "本方新获得金色棋子，且其类型属于干员时。普通购买不满足金色条件。",
  },
  ENTER_DANGER: {
    title: "危险状态提示",
    trigger:
      "已登记 ON_AUTOCHESS_ENTER_DANGER 音频事件；具体生命值、回合或状态条件待核对。",
  },
  EQUIP_BONUS: {
    title: "装备升级效果",
    trigger: "本方新获得金色棋子，且其类型属于装备时。",
  },
  BATTLESTART: {
    title: "普通作战开始",
    trigger: "HUD 切换到普通作战状态，显示作战开始横幅时。",
  },
  YOURTURN_CIRCLE: {
    title: "轮到己方操作",
    trigger: "局内轮到己方的自选提示面板播放入场动画时。",
  },
  TARGET: {
    title: "模拟开场提示",
    trigger:
      "模拟开场提示面板显示时。该输入同时触发模拟开始播报，可与 CN_001 / CN_002 / CN_003 中选出的一条一起播放。",
  },
  ROUNDSTART: {
    title: "回合开始横幅",
    trigger: "回合开始面板显示新回合信息时。",
  },
  REST: {
    title: "整备阶段",
    trigger: "HUD 切换到整备状态时。",
  },
  ADD_BOND: {
    title: "盟约增加效果",
    trigger:
      "目标棋子收到新增羁绊提示、播放提示特效时；目标必须存在，且不处于该棋子的提示锁定期。触发后同一棋子锁定 10 个逻辑 tick。",
  },
  BOSSROUND_TEAM: {
    title: "协同领袖回合预告",
    trigger: "多人领袖回合准备对话框播放预告动画时；音频配置延迟 0.12 秒起播。",
  },
  BOSSROUND_SINGLE: {
    title: "单人领袖回合预告",
    trigger: "领袖回合准备对话框显示普通领袖预告时。",
  },
  BOSSROUND_SECRET: {
    title: "隐秘领袖回合预告",
    trigger: "领袖回合准备对话框显示隐秘领袖预告时。",
  },
  KILLBOSS_ALL: {
    title: "隐秘领袖战胜利",
    trigger: "结束对话框显示隐秘领袖战胜利（HIDE_BOSS_WIN）结果时。",
  },
  KILLBOSS: {
    title: "隐秘领袖战失败",
    trigger:
      "结束对话框显示隐秘领袖战失败（HIDE_BOSS_FAIL）结果时。文件名含 killboss，但对应的是这个失败分支。",
  },
  DEFENCE_UNITE: {
    title: "进入支援战斗",
    trigger: "进入支援战斗，显示协同提示面板时。",
  },
  DEFENCE_START: {
    title: "防卫开始",
    trigger: "HUD 播放防卫开始提示时。",
  },
  BATTLEOVER_REDUCE: {
    title: "回合结果 · 损失生命",
    trigger: "回合结算中，自己对应的结果记录 lostHp 大于 0 时。",
  },
  BATTLEOVER_NOREDUCE: {
    title: "回合结果 · 全员完美",
    trigger:
      "回合结算的全部结果记录都未损失生命（lostHp < 1）时。此分支优先于个人完美。",
  },
  BATTLEOVER_NORMAL: {
    title: "回合结果 · 个人完美",
    trigger:
      "回合结算中，自己对应的结果记录未损失生命，但并非全部玩家都未损失生命时。",
  },
  GOFIRST: {
    title: "自身被淘汰",
    trigger: "自身淘汰对话框显示时。",
  },
  DISCONNECT: {
    title: "模拟结束",
    trigger:
      "结束对话框进入 GAME_OVER 分支时。资源名为 disconnect，实际绑定的是模拟结束结果。",
  },
  KILLBOSS_NORMAL: {
    title: "普通领袖战胜利",
    trigger: "结束对话框显示普通领袖战胜利（NORM_BOSS_WIN）结果时。",
  },
  BATTLESTART_BOSS: {
    title: "领袖作战开始",
    trigger: "HUD 切换到领袖作战状态时。",
  },
  POPUPGRADE: {
    title: "晋升 / 中心升级气泡",
    trigger:
      "玩家状态栏显示干员晋升或调度中心升级广播气泡时。两类气泡共用这条音效。",
  },
  POPNOREDUCE: {
    title: "完美作战气泡",
    trigger: "玩家状态栏播放完美作战广播气泡时。",
  },
  POPGOFIRST: {
    title: "玩家淘汰气泡",
    trigger: "玩家状态栏显示玩家被淘汰气泡时。",
  },
  POPDAMAGE_20: {
    title: "领袖伤害气泡 · 20% 档",
    trigger:
      "收到领袖伤害广播 comment_boss_hit_1，显示 damage_percentage_1 评价气泡时。当前配置的档位阈值为 20%；服务端决定广播哪一档。",
  },
  POPDAMAGE_40: {
    title: "领袖伤害气泡 · 50% 档",
    trigger:
      "收到领袖伤害广播 comment_boss_hit_2，显示 damage_percentage_2 评价气泡时。当前配置的档位阈值为 50%；服务端决定广播哪一档。资源名中的 40 并非当前广播阈值。",
  },
  POPDAMAGE_80: {
    title: "领袖伤害气泡 · 80% 档",
    trigger:
      "收到领袖伤害广播 comment_boss_hit_3，显示 damage_percentage_3 评价气泡时。当前配置的档位阈值为 80%；服务端决定广播哪一档。",
  },
  ACTIVATION: {
    title: "技能激活",
    trigger: "局内 HUD 技能卡播放激活动画时。",
  },
  SKILLSWAP: {
    title: "技能切换",
    trigger: "自身技能卡已经存在、技能 ID 发生变化并播放解锁动画时。",
  },
  CURSORDRAG: {
    title: "技能拖动指向",
    trigger: "拖动技能时显示目标箭头。",
  },
  LOAD3: {
    title: "卫戍协议入口",
    trigger: "进入卫戍协议活动入口，赛季开启或休赛期入口播放入场动画时。",
  },
  SHOP_BUY: {
    title: "确认购买商品",
    trigger: "可露希尔终端的商店卡片确认购买时。",
  },
  STRATEGYDETAIL: {
    title: "查看阵营详情",
    trigger: "阵营选择页点击阵营按钮、展开阵营详情时。",
  },
  SETTLEMENT_TEAM: {
    title: "进入团队结算",
    trigger: "个人结算页点击下一步，进入团队结算页时。",
  },
  MATCH_SUCCEED: {
    title: "匹配成功",
    trigger: "匹配页播放匹配成功动画时。",
  },
  MATCH_FAIL: {
    title: "匹配失败",
    trigger: "匹配页播放匹配失败动画时。",
  },
  MATCH_CANCEL: {
    title: "匹配取消",
    trigger: "取消匹配提示横幅出现时。",
  },
  PLAYER_JOINROOM: {
    title: "玩家加入房间",
    trigger: "房间成员变化处理检测到有玩家加入并显示提示时。",
  },
  PLAYER_READY: {
    title: "房间玩家准备",
    trigger: "房间玩家卡片的准备状态发生变化、进入准备状态时。",
  },
  YOURTURN: {
    title: "轮到你选择阵营",
    trigger:
      "阵营选择页显示轮到自己选择的提示横幅时；音频配置延迟 0.2 秒起播。",
  },
  STRATEGY: {
    title: "阵营选择阶段切换",
    trigger: "阵营选择页更新阶段数据并播放阶段切换提示时。",
  },
  COUNTDOWN: {
    title: "倒计时紧急提示",
    trigger:
      "倒计时面板首次进入紧急提示状态时。普通准备、特殊准备和战斗阶段的当前阈值均为 10 秒；不是每秒重复播放。",
  },
  SETTLEMENT_FAIL: {
    title: "个人结算 · 失败",
    trigger: "个人结算页以失败结果播放入场动画时。",
  },
  SETTLEMENT_SUCCEED: {
    title: "个人结算 · 成功",
    trigger: "个人结算页以成功结果播放入场动画时。",
  },
  SETTLEMENT_BOSSSIGN: {
    title: "隐秘领袖结算标记",
    trigger: "个人结算页播放隐秘领袖标记效果时。",
  },
  GOODEVALUATION: {
    title: "团队结算点赞",
    trigger: "团队结算中给其他玩家点赞，或播放收到点赞动画时。",
  },
  STANDBYCHECK: {
    title: "选择确认",
    trigger: "阵营选择或自选准备页的玩家卡片进入确认状态时。",
  },
  READYTOPLAY: {
    title: "自选准备完成",
    trigger: "自选准备页中“自己已准备或所有人已准备”从否变为是时。",
  },
  ADMISSION: {
    title: "玩家阵容展示",
    trigger: "玩家入场展示页需要播放背景入场动画时。",
  },
  START: {
    title: "作战准备入场",
    trigger: "作战准备页播放进入动画时。",
  },
  MAGIC_PLACE_BATTLE: {
    title: "战场法术放置",
    trigger:
      "法术类（MAGIC）棋子放置在战场时，从棋子的世界位置播放。放到手牌区域会走另一个音频事件。",
  },
};
