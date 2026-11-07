# 小星 Agent 0.3.1 · 黑金工作台测试版

0.3.1 修复：改用 Google 管理的 Docker Hub 镜像缓存入口下载 Debian；安装失败显示中文阶段，不显示成功；已有可用容器跳过安装，无法启动的旧容器保留数据。Linux 非零退出码改为明确的错误，缺少容器时提示还缺哪一步。

两项目标同时保留：① Linux 写代码、做游戏和持续调试；② 独立的虚拟手机/电脑用于游戏和 QQ。第二项仍待单独接入，当前修复只处理第一项的安装失败。

原有功能包含原生黑金界面、响应计时、Termux / PRoot Debian 命令连接、HTML 游戏预览与日志、截图后的坐标点击和滑动。保持原包名和签名，可直接覆盖 0.1 / 0.2 安装，保留模型设置、密钥和应用工作区。

代码已编译并签名。手机系统授权、Termux 命令回传、第三方游戏和 QQ/B站操作仍需在荣耀 80 上验证。

## PRoot 是什么

PRoot 通过用户空间系统调用转换提供类似 chroot 的 Linux 文件环境，不需要 Root。它共享手机内核，不是另一个 Android 系统，也不是强隔离的虚拟机。

本版使用 Termux 作为执行宿主，在其中安装名为 xiaoxing 的 Debian 容器。小星通过 Termux 官方 RUN_COMMAND 接口发命令并取回输出。APK 没有捆绑整个 Linux 根文件系统，也不能远程静默安装到手机。第一次需要用户安装 Termux、运行初始化指令并授权；之后可以在小星里调用 Linux。

Linux 工作目录为 /root/xiaoxing-workspace；应用文件工具工作区在小星私有目录，两者不同。初始化没有安装 Android SDK、浏览器桌面或 Android 虚拟机，不能承诺手机上构建任意 APK。

## 手机上怎样安装

1. 覆盖安装 Xiaoxing-Agent-0.3.1-test.apk，不要先卸载。
2. 打开小星的 Linux 面板，点“① 安装 / 打开 Termux”。官方 F-Droid：https://f-droid.org/packages/com.termux/ 。安装后先打开 Termux，等基础环境初始化完成。
3. 回到小星，点“② 复制初始化指令”。去 Termux 长按 → 粘贴 → 回车，等待最后出现“小星开发环境安装完成 / Setup complete”。该指令在 APK 内，下载的软件来自 Termux / Debian 软件源，基础镜像从 mirror.gcr.io 的 Debian 官方镜像缓存获取；指令会允许已授权外部 App 调用 Termux。
4. 该过程安装 PRoot-Distro、Python、Debian，以及 Debian 内的 Python3、Node/npm、Git、curl。请预留约 2 GB 空间，实际大小和耗时取决于软件版本与网络。下载失败时查看 Termux 报错，不能跳过后当成完成。
5. 回小星，点“③ 授予运行命令权限”，允许小星在 Termux 环境运行命令。再点“④ 检测 Python / Node / Git”。看到 Linux 退出码 0 和各工具版本才是检测命令完成。
6. 对话里勾选 Linux，试用下面的指令：

```
在 Linux 创建一个 Python 文件，计算 1 到 100 的和，运行后报告真实输出和退出码。
```

初始化脚本也放在 assets/setup-linux.sh。不需要在 Linux 中再填写模型 API Key，模型仍由小星 App 调用。

### 检测失败时

- 未安装 Termux：先完成步骤 2。
- 权限拒绝：小星需要 com.termux.permission.RUN_COMMAND，同时 Termux 的 ~/.termux/termux.properties 需要 allow-external-apps=true，初始化脚本会设置后者。
- 找不到 Python / proot-distro：初始化未完成，查看 Termux 安装日志。
- 找不到 xiaoxing 容器：Debian 下载/安装未完成。
- 等不到回传：查看 Termux 通知、权限和系统后台限制。系统可能在后台终止进程。
- ptrace / PRoot 被系统拒绝：设备策略可能不兼容，本版不会绕过系统安全策略。

## 手机操作与游戏

手机模式使用用户主动启用的无障碍服务。提供页面节点读取、截图、节点点击、文字输入、滚动、返回、桌面、启动应用，以及 0~1000 归一化坐标的点击和滑动。坐标手势前需在 60 秒内获取过页面或截图，单次滑动最多 2 秒。

这为 AI 逐步操作游戏和页面提供工具。模型延迟、识别错误、受保护页面和系统限制都会影响效果，不能保证即时动作/竞技游戏能玩好。

在“能力”面板可打开“本地游戏测试场”。也可开启手机模式后对 AI 说：

```
打开本地星核训练场，读取页面或截图，按 01、02、03 顺序点击。
每次点击后检查状态，最后确认页面是否显示“验证完成”。
```

自带测试场仅用于基本交互，不代表第三方游戏已验证。

### HTML 游戏运行与调试

AI 可以 write_file 创建单文件 HTML，再用 preview_html 在手机 WebView 运行。preview_status 返回预览真实记录的加载状态、JavaScript 控制台消息和加载错误。手机模式可截图、读取和点击页面。

此 WebView 没有 JavaScript→Java 接口，不允许文件系统或 Content Provider 访问。本版建议使用单文件 HTML，不支持相对本地素材。控制台没有报错不等于游戏功能正确，还需操作验证。

## QQ / B站机器人怎么实现

常见两类做法：

- 消息机器人：平台事件/Webhook 或消息桥收到消息，调用模型，再通过平台接口回复。长期运行需要消息连接和服务进程，不能只靠安装 PRoot。
- 页面自动化：模型看截图或页面，操控手机 App / 浏览器。普通账号仍需用户手动登录，并按平台权限和规则使用。

本版只提供第二类的基础手机工具，没有 QQ/B站专用接入、后台群消息监听或长期自动发言服务。不会自动创建账号、登录或自行去评论区发言；发送消息/评论应由用户明确指定操作。

## 计时与持续运行

- 上方显示本轮响应等待秒数、任务总时长；模型回复下方显示接口返回的模型标识与响应耗时。
- 计时包括网络和模型推理，不是服务商内部独立的纯思考时间。没有伪造思维链。
- 接口提供 usage 时显示任务累计 Token，不推算价格。
- 默认每次任务最多 24 轮、10 分钟；设置可调整到 4~64 轮、1~30 分钟。不是无限挂机。
- Linux 单命令限制 5~120 秒。超时或停止会请求终止当前进程组；系统拒绝服务调用或终止宿主时，无法保证即时停止回传。
- 前台通知、对话发送位置的停止按钮、手机悬浮停止按钮都可停止。
- Linux 命令结束会清理其进程组，不支持通过该工具留下永久后台服务器。持续服务需要单独设计。

## 模型与数据

保留自定义接口、文字和视觉模型分别配置、连接测试、详细错误和复制诊断。新增 DeepSeek Flash 预设、思考开关适配和 reasoning_content 回传；没有用用户真实 DeepSeek Key 做付费调用验证。

切换平台预设会清空 API Key，请填写对应平台的密钥。免费额度与账号资格需在服务商确认，App 不提供内置免费账号。密钥通过 Android Keystore 加密保存。

工作区文件、模型配置和密钥保留。会话目前仅在应用进程内；任务图片完成后会从历史上下文移除。卸载会删除应用私有数据，请先导出文件。

## 开发构建

需要 JDK 17、Android SDK Platform 35、Build Tools 35.0.0：

```bash
ANDROID_JAR=/your/android-sdk/platforms/android-35/android.jar \
BUILD_TOOLS=/your/android-sdk/build-tools/35.0.0 bash build.sh
```

生成 dist/Xiaoxing-Agent-0.3.1-test.apk。源代码包不包含签名私钥、SDK 或 API Key。自行重建如使用新签名，不能直接覆盖本次 APK。

验证记录见 VALIDATION.md。代码检查、模拟服务和脚本测试不能视为荣耀 80 真机通过。

官方参考：
- https://github.com/termux/proot-distro
- https://github.com/termux/termux-app/wiki/RUN_COMMAND-Intent
- https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/
- https://developer.android.com/reference/android/accessibilityservice/AccessibilityService
