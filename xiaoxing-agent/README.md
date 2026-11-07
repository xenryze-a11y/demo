# 小星 Agent 0.4.0 测试版

本轮重点补齐 DeepSeek 工具联网、通用附件、持续工作，以及把本应用继续交给小星修改的链路。独立 Linux 桌面已接入；安卓虚拟手机还需要云手机或电脑模拟器的运行端。

## 下载与安装

`releases/Xiaoxing-Agent-0.4.0-preview.apk` 是可与旧版并存的**独立测试版**（包名 `app.xen.xiaoxing.preview`），需要单独填写模型配置和授权。它不会迁移旧版的私有文件、会话、密钥。请保留原来的小星。

本轮未取得原签名私钥，因此没有提供可直接覆盖 0.3.1 的升级 APK。`0.4.0-unsigned.apk` 已编译，原签名持有人可签名后升级。正式构建会核对旧版证书，拒绝用另一把密钥冒充覆盖更新。

## 联网

- 对话下方默认开启「联网搜索 / 网页读取」，模型可调用 `web_search` 和 `web_read`。
- 搜索使用 Bing 公开 RSS；网页工具实际请求 HTTPS 公网，返回来源、HTTP 状态、抓取时间和正文。无需 DeepSeek 另开内置联网权限。
- 不向搜索服务或网页发送模型 API Key。搜索词会交给搜索服务，读取后的摘要/正文会交给用户配置的模型。取消联网可关闭这些工具。
- 不执行网页 JavaScript，不代登录、不绕过验证码；受限页面会明确报错。PDF/图片下载不冒充网页正文。
- 「能力 → 检测真实网页联网」可以不调用模型单独测试搜索和网页读取。

试用：`搜索 DeepSeek 当前官方 API 文档，打开原文核实，并附来源网址。`

## 附件与文件容量

点「＋ 附件 → 文件 / 源码 / ZIP / APK」。每轮最多附加 8 个文件，**单个最多 64 MiB（67,108,864 字节）**。文件服务未报告容量时，会边复制边统计实际字节，超过上限即停止并清理未完成文件；导入前要求至少 72 MiB 可用空间。

文件保存在小星私有工作区，导入后显示路径和实际大小。发送消息只传附件路径；模型用 `file_info` 检查大小，再读取所需内容。64 MiB 是文件导入上限，不代表模型能一次读入这么多内容。

- UTF-8 文本 / 源码：`read_file` 每页最多约 10,000 字符，按 `next_offset` 继续。文本写入单文件仍限制 128 KiB。
- APK / ZIP：`inspect_archive` 分页查看目录或其中的文本；`extract_archive` 提取到新目录；`pack_directory` 打包工程。提取限制路径、条目数与展开容量。
- PDF / Office / 其他二进制：可保存、导出和传进 Linux，但需对应解析软件；导入成功不等于解析成功。
- 「文件」显示字节大小，支持附加、文本预览、归档目录和**原始二进制导出**。不把 APK 重新编码成文本。
- App 文件箱、Debian `/root/xiaoxing-workspace`、Termux 原生 `$HOME/xiaoxing-workspace` 是三个工作区。`linux_push` / `linux_pull` 双向传文件；`native_termux=true` 选择 Termux 原生工作区。

## 以后让小星继续修改自己

0.4.0 的 APK 包含 `assets/self-source.zip`，里面是可编辑源码、构建脚本和交接说明。点「能力 → 提取本应用源码」，或让模型调用 `project_source`，然后阅读 [SELF-DEVELOPMENT.md](SELF-DEVELOPMENT.md)。

小星调用的是你自己配置的 API，修改代码不依赖 Codex 的额度，仍需要模型服务商有可用额度。工程可以保留、修改、传入 Termux 编译，再把新 APK 取回并导出。

要在荣耀手机上构建本应用，先在 Linux 面板复制「安装 APK 构建工具」指令，到 Termux 运行一次。它从 Termux 官方源安装原生 aapt2、JDK、d8、apksigner，并校验下载的 Google Android Platform 35。手机安装与实际编译尚待真机验证。不要在 Debian 里运行这些 Android 原生二进制。

**签名私钥不包含在 APK 或源码里。** 可并存测试版使用自己的签名；覆盖原小星需要之前私下保存的原签名备份，且应由持有人执行签名。0.3.1 和任意第三方 APK 通常不包含完整工程，不能保证仅靠反编译还原。

试用：`提取你自己的源码，先读 SELF-DEVELOPMENT.md，检查联网工具实现，修改后编译独立测试 APK；报告真实构建结果，并取回 APK 供我导出。`

## 会话与中断续做

会话和界面记录存于应用私有目录，应用重开后恢复。完整工具轮次会保存；API 限额、停止或时限中断后，已经写入的文件保留，模型能看到已完成和未执行的工具记录。

上下文过长时保留当前用户指令和最近完整工具轮次，较早内容按需从工作区重新读取。不会把半组 tool_calls 拼进下一次请求。历史图片不持久保存，需要时重新上传或截图。突然被系统杀死的运行中轮次不保证恢复，可先检查文件和实际环境。

任务默认 24 轮 / 10 分钟，可调整到 64 轮 / 30 分钟。它还不是无限持续运行的消息机器人。新建会话会清除上下文并保留工作区；卸载会删除应用私有数据，请先导出工程。

## Linux 开发环境

Linux 面板原有流程保留：安装 Termux → 复制基础初始化指令到 Termux → 授予运行命令权限 → 检测 Python / Node / Git。

基础脚本使用 `mirror.gcr.io/library/debian:bookworm` 安装名为 `xiaoxing` 的 PRoot-Distro 容器，保留已有容器和工作区，失败不会显示安装完成。PRoot 共享手机内核和 Termux 权限，并非强隔离虚拟机。基础环境建议预留约 2 GiB，实际随软件和缓存变化。

`linux_exec` 在 Debian 执行；`termux_exec` 在 Termux 原生环境执行。两者单命令 5~120 秒，停止/超时会请求终止命令进程组，不用于留下后台守护进程。

## 独立 Linux 桌面

Linux 面板新增：

1. 「安装桌面软件」：复制指令到 Termux，安装 Xfce、TigerVNC、noVNC、xdotool、xclip 等。建议额外预留 2 GiB。
2. 「启动独立桌面」：开启单独的 Termux 终端会话，保持该会话运行。此时只报告已请求启动。
3. 「检测独立桌面」：以实际 Xvnc、Xfce、noVNC 进程状态判断是否就绪；失败请查看 Termux 原始日志。
4. 「打开独立桌面」：在应用内查看 noVNC。服务器仅监听 `127.0.0.1`，控制 API 使用随机令牌，VNC 使用独立随机密码。
5. 回到对话勾选「独立桌面操作」。须配置并测试可用的视觉模型。提供 `desktop_status`、`desktop_screenshot`、`desktop_action`；每次动作前要截图，动作后再截图验证。
6. 「停止独立桌面」单独结束桌面会话。停止 AI 任务停止后续工具调用；桌面可继续保持运行，仍受手机后台限制。

中文输入通过独立桌面剪贴板粘贴；普通应用用 `ctrl+v`，终端用 `ctrl+shift+v`。开发环境已实际验证 Xfce/noVNC、截图、点击、中英文输入、按键、结果回读和关闭；这不等于荣耀 80 已完成安装或验证。

桌面可以安装支持相应 CPU 架构的 Linux 软件。当前没有预装 QQ，没有登录账号，也没有群消息监听或自主发言。普通 Android QQ / 原生手游不能直接在 PRoot 桌面运行。独立安卓虚拟手机须另接云手机或电脑模拟器；尚未接入或购买服务。

「手机」开关仍是用户手动开启的无障碍服务，会操作当前真实手机屏幕；不要与「独立桌面操作」混淆。

## 开发构建

JDK 17+、Android Platform 35、Build Tools 35.0.0，或已初始化的 Termux 原生构建工具：

```sh
ANDROID_JAR=/path/android.jar BUILD_TOOLS=/path/build-tools bash build.sh
# 默认只生成 unsigned，不生成替换旧签名的密钥。
BUILD_VARIANT=preview ANDROID_JAR=/path/android.jar BUILD_TOOLS=/path/build-tools bash build.sh
```

构建自动打包源码，排除密钥、缓存、旧 APK 和发布包。没有 native zipalign 时使用本工程的 Python 对齐工具；APK 不含 native .so。正式签名方法见 SELF-DEVELOPMENT.md。测试与未验证项见 [VALIDATION.md](VALIDATION.md)。
