# 自动构建

工作流为 `.github/workflows/build.yml`，在 push、pull request 与手动运行时触发。相同事件和分支的新提交会取消旧构建。工作流只需读取仓库权限，构建完成后将文件保存为 Actions Artifacts，保留 14 天。

| 产物 | Runner | 输出 |
| --- | --- | --- |
| `Wardtone-windows-x64` | `windows-latest` | x64 NSIS 安装程序和 ZIP |
| `Wardtone-macos-arm64` | `macos-latest` | Apple Silicon 应用 ZIP |
| `Wardtone-macos-x64` | `macos-26-intel` | Intel 应用 ZIP |

2026-11-14 核对 [GitHub Runner 官方列表](https://github.com/actions/runner-images/blob/main/README.md)：Windows latest 为 Windows Server 2025，macOS latest 为 macOS 26 ARM64。Intel 使用当前最新的标准 `macos-26-intel`，其后续版本发布时更新该矩阵项。两个 `latest` 标签跟随 GitHub 的稳定镜像升级。

Node.js 使用 `.node-version` 中的 26 LTS。Actions 版本为 checkout 7.0.1、setup-node 7.1.0、upload-artifact 7.0.2。依赖通过 `npm ci` 严格安装 `package-lock.json`，npm 缓存按锁文件更新；不缓存 node_modules。

每个平台依次执行：

1. 记录实际镜像、操作系统、CPU 架构、提交和 Node 版本。
2. 安装依赖，运行 TypeScript 检查与 `npm test`。
3. 使用对应 `package:*` 命令构建前后端并打包。
4. 上传安装包、ZIP 和单独的诊断附件。

诊断附件名为 `diagnostics-平台-架构`，包含 `environment.json`、JUnit `results.xml` 和 electron-builder 已生成的配置/调试文件。测试或打包失败时仍会尝试上传已有诊断，详细错误保存在失败步骤的 Actions 日志中。应用包内置运行时，用户无需安装 Node.js。当前构建为未签名包，不需要签名证书或发布密钥。

## 测试范围

`npm test` 包含独立生成的二进制/音频数据、路径安全、分享包、配置、清单扫描、用途目录、ADB 协议和主题测试。Windows 上还会创建带中文名称和环境变量路径的临时 HKCU 卸载项，读取 32/64 位视图并查找嵌套资源清单，结束时删除临时数据。该项在 macOS 上标记跳过。

真实游戏副本测试单列为 `npm run test:fixtures` 和 `npm run test:integration`，由开发者在本机准备 `.fixtures/Bundles` 或设置 `WARDTONE_FIXTURE` 后运行。游戏二进制素材不进入 CI。用途目录的跨平台测试使用已登记的资源标识；真实资源与标识的逐项一致性检查保留在 `tests/local/cue-fixtures.test.ts`。

Windows CI 可验证 Windows 文件操作、注册表读取和应用打包；实际客户端安装布局与具体模拟器的连接结果记录在 [验证记录](verification.md)。
