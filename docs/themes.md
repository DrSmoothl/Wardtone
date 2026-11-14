# 终端主题

四套主题共享业务界面与控件，分别配置完整外观。默认主题为 `closure`。`wardtone` 保留原有界面与强调色偏好，`terminal`、`closure` 固定深色，`ursus` 使用浅色金属面板与深青机架。

## 扩展契约

| 位置                                            | 职责                                            |
| ----------------------------------------------- | ----------------------------------------------- |
| `src/shared/themes.ts`                          | 稳定 ID、名称、顺序、原生外观、强调色能力、说明 |
| `src/renderer/themes/types.ts`                  | 完整的色彩、字体、几何与装饰 token 契约         |
| `src/renderer/themes/<id>.ts`                   | 独立主题定义；资源通过静态导入随包发布          |
| `src/renderer/themes/index.ts`                  | 类型化注册表、完整解析、根节点应用              |
| `src/renderer/themes/chrome.css` 与 `profiles/` | quiet / arcade / tactical / industrial 外壳结构 |
| `src/renderer/themes/ThemePresentation.tsx`     | 预览、侧栏身份区、工作台操作台                  |

新增主题时：

1. 在共享登记表加入稳定 ID、名称和外观策略，ID 不随显示名称修改。
2. 新增一个符合 `ThemeSpec` 的模块，从完整基础 palette 开始，明确覆盖自身色彩、字体、几何及图片。没有装饰的槽位必须返回 `none`。
3. 在 `themeSpecs` 注册。TypeScript 会检查登记表与实现是否齐全；设置页自动枚举登记表，不需要修改页面逻辑。
4. 复用现有 chrome，或新增一种有明确结构差异的 chrome。页面禁止按具体主题 ID 分支，图片不能承载唯一的按钮文字或业务状态。
5. 添加本地资源来源与字体授权，运行类型检查和主题测试，检查实际界面的菜单、对话框、125% 缩放与键盘切换。

`resolveTheme` 每次返回完整 token，`applyTheme` 全量写入根节点，因此从复杂主题切回经典不会留下字体、背景图或边框。主题变更只更新配置和 CSS，不重建编辑器与草稿。主题初始化发生在 `useTheme` 的布局阶段，React 启动入口不依赖主题定义，修改主题代码不会重新创建根节点。系统外观变化只影响经典；Electron 的原生外观采用同一共享登记表。

试听播放器位于主内容列中，在滚动区域之后、状态栏之前，按实际高度参与布局。主题只设置播放器外观，不使用固定定位覆盖内容，也不按侧栏宽度计算播放器位置；播放器出现或缩放变化时，滚动区域自动收缩，列表末条仍完整可见。

配置版本 3 将 `theme` 保存为主题 ID。版本 1/2 先严格验证再保存原始字节备份，迁移到默认可露希尔，保留连接、作者、缩放、动效与替换偏好。未知主题报错；成功切换记录 `theme.changed` 的前后主题、强调色和操作 ID，随诊断日志导出。

## 资源来源

主题图片对应《明日方舟》资源版本 `26-11-06-13-05-11-41977313`，按以下来源登记。

| 资源包                                                  | 用途                         |
| ------------------------------------------------------- | ---------------------------- |
| `ui/autochess/autochessvariantskin/[uc]ac_s_closur.ab`  | 可露希尔标识、窗口与色彩参考 |
| `ui/autochess/autochessvariantskin/[uc]ac_n_initial.ab` | 初始终端等高线、战术框架参考 |
| `ui/autochess/autochessvariantskin/[uc]ac_n_iron.ab`    | 乌萨斯徽章、工业框架参考     |
| `ui/autochess/[uc]autochessouter.ab`                    | 三套背景与游戏内预览参考     |

实际使用 25 张 PNG；文件名、来源、图片标识和摘要见 `src/renderer/themes/assets/provenance.json`。游戏美术来源为《明日方舟》，权利归鹰角网络及相应权利人，适用说明见 [第三方素材](../THIRD_PARTY_NOTICES.md)。主题名称可对照[官方活动公告](https://ak.hypergryph.com/news/0787.html)与[终端主题一览](https://prts.wiki/w/卫戍协议/终端主题一览)。

## 字体

| 字体                      | 使用位置                     | 来源                                                                               |
| ------------------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| 得意黑 Smiley Sans 2.0.1  | 可露希尔中文标题             | [atelierAnchor](https://github.com/atelier-anchor/smiley-sans/releases/tag/v2.0.1) |
| Chakra Petch SemiBold     | 可露希尔编号、英文标题、读数 | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/chakrapetch)          |
| Rajdhani SemiBold         | 卫戍终端编号、英文标题、读数 | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/rajdhani)             |
| Barlow Condensed SemiBold | 乌萨斯编号、英文标题、读数   | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/barlowcondensed)      |
| IBM Plex Mono             | 语音编号、摘要及日志         | 随 npm 依赖内置                                                                    |

字体从本地文件加载，随 Vite 产物进入 Electron 包。完整授权文件位于 `resources/licenses`；原字体文件与来源摘要位于 `resources/fonts-manifest.json`。正文使用系统中文字体，字体切换仅影响主题指定的展示区域。
