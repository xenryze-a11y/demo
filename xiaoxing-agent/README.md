# 小星 Agent 0.5.0 · 内置独立电脑

本版完整 APK **内置约 171 MiB 的 ARM64 Linux 电脑系统**。里面已安装 Xfce 桌面、NetSurf 轻量浏览器、文件管理器、文本编辑器、终端、Python、Node 和 Git。首次在手机解包安装后，AI 可以后台操作，用户可以实时观看、开画中画、临时接管，再交还 AI。

这是共享 Android 内核、通过 Termux/PRoot 运行的独立 Linux 电脑，不是 Android 客体系统，也没有给真实手机取得 Root。它支持 Linux 软件，包括另行安装官方 ARM64 Linux QQ；Android APK 需要安卓客体，不能作为 Linux 软件运行。

## 下载与升级

[下载 0.5.0 完整测试 APK](https://github.com/xenryze-a11y/demo/releases/download/xiaoxing-v0.5.0-test/Xiaoxing-Agent-0.5.0-preview-full.apk)。完整包比 0.4 大，因为真正包含了电脑系统。系统包与 APK 的 SHA-256 在同一 Release 的 SHA256SUMS.txt 中。

包名为 `app.xen.xiaoxing.preview`，保持本项目 0.4.0 preview 的同一签名，**可覆盖此前下载的 0.4.0 并存测试版并保留其配置和工作区**。它与原包名 `app.xen.xiaoxing` 的 0.3.1 分开；升级原包名版本仍需之前私下保存的原签名。请保留已有 App，不要先卸载。

## 手机上开始使用

1. 安装完整 APK，打开顶部「电脑」。手机需 ARM64（荣耀 80 符合），首次准备至少留出 **2 GiB 可用空间**。
2. 若已连接 Termux 并授予命令权限，可直接进行下一步。新手机先安装 Termux，点「首次连接 Termux」，将一次性的宿主设置指令在 Termux 粘贴执行，再返回授权。此步骤设置 Termux 允许小星调用命令；不下载 Linux 或 Android SDK。
3. 点 **「安装并启动内置独立电脑」**。小星会校验并传入内置完整系统包，创建独立的 `xiaoxing-desktop` 容器，核对软件并启动桌面。原 `xiaoxing` 开发容器保留。Termux 安装会话需保持运行。
4. 小星会显示实际安装阶段、错误与就绪检测。出现「独立电脑已就绪」后，点 **「查看实时画面 / 临时接管 / 小窗」**。
5. 对话勾选「独立电脑操作」，使用支持图片的视觉模型并测试其权限，便可给 AI 任务。文字聊天、联网搜索等仍可单独使用。
6. 要保持手机后台任务，按系统设置允许 Termux 和小星持续运行。Android 仍可能杀死进程；系统和文件保留，可再次点安装并启动恢复。

电脑启动和日常使用不需要安装 Android SDK。下方「高级 Linux」保留了旧开发环境及可选 APK 构建工具，编译本应用时才需要它们。

## 实时观看、接管与画中画

- 查看实时 noVNC 画面时，AI 可继续工作；打开查看器不再要求结束 AI 任务。
- 点 **「我来操作」**：等待当前动作完成并收到控制权确认后，画面即可手动点击和输入。AI 的截图、点击、后续工具调用与命令暂停，运行中的 AI 命令进程组也会暂停。
- 点 **「交还 AI 继续」**：命令恢复，AI 必须重新截图后才能操作，不能照旧截图误点。手动接管时间不消耗 AI 的活跃任务时限。
- 点 **「小窗观看」**：使用 Android 画中画。小窗中实时看画面，点「展开接管」回到完整界面接管。画中画不是在小窗内部直接进行任意触控；直接操作在展开后的完整画面中进行。
- 电脑停止按钮会结束其窗口与任务并保留文件。停止 AI 任务只结束 AI 后续调用；电脑可保持运行。

画中画代码已接入并编译，具体系统权限、荣耀窗口表现与后台限制还需真机验证。原生 App 查看器、Termux 权限/服务接口也需要在用户手机完成首次验证。

## 安装与使用软件

AI 提供以下独立电脑工具：

| 工具 | 用途 |
|---|---|
| `desktop_status` / `desktop_apps` | 查看实际进程、控制权、任务，以及已安装的桌面应用 |
| `desktop_screenshot` / `desktop_action` | 截图，点击、中文粘贴、按键；每次动作后重新截图 |
| `desktop_install` | 从 Debian 源安装软件包；返回任务 ID，不把提交当安装完成 |
| `desktop_exec` / `desktop_job` | 后台执行命令，查看真实日志/退出码或取消任务 |
| `desktop_launch` | 启动预装软件或已安装 `.desktop` 应用，窗口保持运行 |
| `desktop_push` / `desktop_pull` | App 文件箱与独立电脑工作区双向传文件 |

安装任务单次 5~900 秒，有输出限制与取消；长久运行的 GUI 用 desktop_launch。用户接管期间，AI 不继续操作。登录、密码和验证码由用户接管处理；发消息、评论等需要用户明确针对该操作的指令。

「电脑」面板有 **「安装 Linux QQ」** 与 **「打开电脑里的 QQ」**。安装入口从已核对的腾讯官方 HTTPS 地址下载对应架构的 Debian 包，再安装依赖；需联网、额外空间与时间。QQ 本体没有预装到离线系统，未替用户登录或发消息。提交安装后点检测/日志，或让 AI 用 desktop_job 检查任务真实结果。

NetSurf 为预装的轻量浏览器；需要完整现代网页能力时可另装 Firefox ESR 等 Linux 浏览器。首次安装额外软件通常需要更新 Debian 软件目录并联网下载。

## 联网、附件与继续修改本应用

保留 0.4 的真实网页搜索/读取、来源链接、模型 Key 加密、文件工具、HTML 游戏预览和本机无障碍工具。

- 附件每轮最多 8 个，单个导入与传输提高到 **256 MiB**，可以接收本版完整 APK。显示真实字节大小；长文本分页，APK/ZIP 可检查、提取和打包，原文件按二进制导出。文本写入单文件仍为 128 KiB。
- `desktop_push/pull` 使用新电脑 `/root/xiaoxing-workspace`。旧 `linux_exec` / `linux_push/pull` 仍指向原 `xiaoxing` 容器；Termux 原生构建通过 termux_exec 和 native_termux=true 的传输完成。
- 本 APK 含 `assets/self-source.zip`，提供 App 可编辑源码、构建脚本与交接说明。电脑系统不重复放进源码 ZIP；后续改 App 可继续使用已安装的系统。
- 需要重建完整包时，从同一 Release 获取 SHA-256 匹配的系统包，放到 `assets/offline/desktop-arm64.tar.xz` 再构建；未带镜像的源码构建会从清单 URL 获取系统包。
- 自己的模型 API 与构建工具齐备后，可用 personal 模式在手机生成并保留自己的签名，继续修改、编译并导出本应用，不依赖 Codex 额度。模型服务商额度与 Android 安装/签名要求仍适用。详情见 [SELF-DEVELOPMENT.md](SELF-DEVELOPMENT.md)。

会话与完整工具轮次本地保存，限额/停止后可续做。任务默认 24 轮 / 10 分钟，可调整到 64 轮 / 30 分钟；不是无限持续群聊服务。

## 构建与验证

JDK 17+、Android Platform 35、Build Tools 35.0.0：

```sh
ANDROID_JAR=/path/android.jar BUILD_TOOLS=/path/build-tools BUILD_VARIANT=preview bash build.sh
```

默认 unsigned 使用原包名，不自动生成替换旧签名的密钥。preview 使用独立包名和私下保留的 preview 密钥。完整系统构建参考 `tools/offline-desktop/`；本轮实际使用 QEMU/PRoot 配置 ARM64 包，并用 PRoot-Distro 5.10.3 从最终离线包安装、启动验证。

验证记录见 [VALIDATION.md](VALIDATION.md)，第三方软件、精确包版本与对应源码见 [OFFLINE-DESKTOP-LICENSES.md](OFFLINE-DESKTOP-LICENSES.md)。开发环境已验证不等于荣耀手机已安装；请以手机上的就绪检测和实际画面为准。
