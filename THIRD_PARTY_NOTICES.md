# 第三方素材与许可

Wardtone 的 MIT 许可适用于本项目代码。下列内容保留各自的权利与许可。

## 游戏主题图片

`src/renderer/themes/assets/` 中的主题 PNG 来源于《明日方舟》，名称、角色、美术和商标的权利归鹰角网络及相应权利人所有。本项目不拥有这些内容的著作权，也不通过 MIT 许可授予使用或再分发这些内容的权利。

文件与来源清单见 [provenance.json](src/renderer/themes/assets/provenance.json)，主题使用位置见 [主题文档](docs/themes.md)。如权利人对项目中的相关内容有疑问，可通过仓库 [Issues](https://github.com/DrSmoothl/Wardtone/issues) 联系维护者。

## 字体

下列字体采用 SIL Open Font License 1.1，完整许可随应用放在 `resources/licenses/`。

| 字体               | 来源                                                                          | 许可                                              |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| IBM Plex Mono      | [IBM Plex](https://github.com/IBM/plex)                                       | [OFL](resources/licenses/ibm-plex-mono-OFL.txt)   |
| 得意黑 Smiley Sans | [atelierAnchor](https://github.com/atelier-anchor/smiley-sans)                | [OFL](resources/licenses/smiley-sans-OFL.txt)     |
| Chakra Petch       | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/chakrapetch)     | [OFL](resources/licenses/chakrapetch-OFL.txt)     |
| Rajdhani           | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/rajdhani)        | [OFL](resources/licenses/rajdhani-OFL.txt)        |
| Barlow Condensed   | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/barlowcondensed) | [OFL](resources/licenses/barlowcondensed-OFL.txt) |

## 音频格式数据

`resources/vorbis-codebooks.json` 的 Vorbis setup header 查找数据来自 [HearthSim/python-fsb5](https://github.com/HearthSim/python-fsb5)，由原始数据转换为 JSON，采用 MIT 许可，版权归 Simon Pinfold（2016）。原始文件为 `fsb5/vorbis_headers.py`，Git blob 标识为 `3bc1329e3ce61b3edca318a45fde31593622cfe5`。完整许可见 [python-fsb5-MIT.txt](resources/licenses/python-fsb5-MIT.txt)。

这份查找数据用于音频格式处理，不包含游戏语音或音乐录音。

## 应用依赖

Electron、React、Radix UI、Yume-chan ADB 及其他依赖的版本记录在 `package-lock.json`，分别遵循各依赖包提供的许可。依赖包自带的版权和许可文件随相应依赖保留。
