# 0.5.0 完整离线电脑验证

2026-11-08，北京时间。分别记录真实 ARM64 系统、真实 GUI/浏览器、模拟 Android/模型服务，以及尚需手机确认的内容。

## 完整系统包

- `desktop-arm64-v0.5.0.tar.xz`：178,925,120 字节，SHA-256 `cbdee4c4c3594424ca9984b4146216e9ba1a5c30c7953efc783e819c644b16cc`。
- 基于校验过的 Debian Bookworm 官方 ARM64 镜像，实际安装并配置了 428 个二进制包。使用 QEMU user-mode、PRoot 与受管理 Docker 环境完成 ARM64 软件配置，没有把 x86 二进制冒充手机 ARM64 系统。
- 核对 Python 实际报告 `aarch64`、Xvnc/Xfce/编辑器/浏览器/文件管理器等 13 个工具、Websockify/NumPy 导入，以及 `dpkg --audit` 无未完成配置。
- 用 **PRoot-Distro 5.10.3** 从最终 171 MiB 离线归档新建容器，实际解包、完成 `/etc/hosts`/解析配置，按 bootstrap 相同步骤创建运行时目录并启动 ARM64 Python/桌面；标记 `OFFLINE_ARCHIVE_INSTALL_AND_ARM64_BOOT_OK aarch64` 通过。
- 从这个新安装的 ARM64 环境实际启动 Xvnc、Xfce、noVNC 和控制服务。修复 PRoot 中 Unix 套接字凭据/路径导致的会话总线错误：会话共享认证总线，PRoot 使用本机 nonce-TCP 与私有 cookie；桌面就绪还检查 xfconf 连接。
- **在运行中的 ARM64 电脑里，通过任务接口实际安装 `galculator`，退出码 0；列出并启动其 `.desktop` 应用，实际窗口可见。** 该计算器是验证时另行安装的软件，不伪称预装进最终系统包。
- **真实浏览器连接这个 ARM64 电脑的 noVNC，切换用户接管、点击和键盘输入、在 Mousepad 保存文件，再交还 AI；通过命令回读文件得到 `Human takeover works. AI is paused.`，退出码 0。**

## 接管、视频与任务

- 原生 Linux 开发环境实际启动 Xvnc/Xfce/noVNC，验证网页、RFB 握手、PNG 截图、点击、中英文粘贴、按键、输入结果与关闭。
- 人工接管后，AI `/screenshot` 与 `/action` 返回 409，新 AI 命令拒绝；进行中的命令进程组暂停，超过 5 秒后日志仍未前进。
- 交还后命令恢复并以退出码 0 完成；旧截图失效，必须重新截图。真实浏览器在 AI 暂停时仍能通过 noVNC 点击/输入，内容到达实际桌面程序。
- 另用离线包里的 noVNC 1.3 静态页面完成真实 Chromium / Playwright 连接、视频、鼠标/键盘和交还验证，避免只验证开发机其他 noVNC 版本。
- Java HumanControl 检查暂停、恢复、暂停时长统计、停止唤醒通过。

## 安装器、模型与文件检查

- 离线安装器模拟 guest 生命周期检查：校验失败前不执行 guest 命令、坏容器保留、不覆盖原环境、提取失败退出码/日志、不假报成功、真实状态响应后才就绪、关闭清理。
- Termux 通过显式一次性 PendingIntent 回传安装错误；安装服务保留阶段/日志，并可重连已进行的安装。完整包从 APK 本地读取系统；源码轻量包按清单下载并校验。
- 231 项 JVM 检查覆盖 API 诊断、文件/归档、网页工具、二进制传输、Linux 命令与真实 Agent 循环。Agent 的 Android 生命周期和模型 HTTPS 使用测试替身，没有使用用户真实 DeepSeek Key 付费调用。
- 文件容量提高到 256 MiB，新增超限数据采用流式检查；保留路径越界、归档展开上限、重复/符号链接、取消清理、原始二进制传输等检查。
- 命令监督的真实子进程超时/退出码/输出截断/子进程清理，旧基础安装脚本失败阶段/容器保留/配置幂等模拟检查，游戏训练场 DOM fixture，通过。
- 真实网页搜索与 DeepSeek 官方 HTTPS 文档读取沿用 0.4 已验证客户端；模型服务商自身权限/限额仍需用户配置实测。

## Android 打包与源码续改

使用 JDK 21、Google Android Platform 35 / Build Tools 35.0.0。完整 APK 把整个校验匹配的系统归档放进 `assets/offline/desktop-arm64.tar.xz`，XZ 不再做无效的 ZIP 二次压缩。

交付前检查资源/Java/DEX 构建、4 字节对齐、preview v2/v3 签名、包名/版本，以及 APK 内镜像和源码的实际校验和。preview 继续使用 0.4 preview 同一证书，versionCode 从 5 升到 6。

App 源码 ZIP 排除镜像、私钥、构建和发布文件，含全部 App 源码、安装器、清单、许可证/对应源码位置和构建脚本。源码提取后在新目录修改并重建；`personal` 模式使用独立个人包名及固定私有目录的手机签名，检查跨目录重建时复用签名。

## 复现测试

```sh
JSON_JAR=/path/json.jar bash tools/run-tests.sh
# 安装 setup-desktop.sh 对应的 Linux GUI 软件后：
python3 tests/test_desktop_live.py /path/desktop-proof.png
# 另需 Chromium 和 Node Playwright：
python3 tests/test_desktop_browser.py /path/browser-proof.png
```

离线包的二进制软件包版本在 `assets/offline-desktop.packages.txt`，对应源码在 `assets/offline-desktop.sources.txt`，许可证说明在 OFFLINE-DESKTOP-LICENSES.md。

## 仍需手机验证

- 荣耀 80 的新 APK 安装、首次宿主设置、Termux RUN_COMMAND/回传、手机文件传输、首次解包和本机真实桌面连接。
- Android 原生查看器的触控/键盘、画中画进入/展开/权限、手机后台与电池策略。已写入并编译，不把浏览器测试算作这些原生 UI 已通过。
- 本轮没有连接用户手机，不能声称已替用户在手机完成授权或已经在其手机后台运行。
- 腾讯官方 QQ 下载入口已核对并提供安装脚本，但没有在用户手机安装/登录/聊天。没有 Android 客体系统、云手机或原生手游验证。
- 原 0.3.1 包的覆盖升级仍缺原私钥。没有将私钥、模型 Key 或用户账号打进镜像/源码/公开仓库。
