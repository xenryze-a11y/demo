# 小星 Agent：Codex 交接

更新：2026-11-08。用户使用荣耀 80，主要在手机操作，没有常用电脑。先阅读本文件、README.md、VALIDATION.md，再检查真实源码。

## 用户要实现的目标

1. 使用自有模型 API 写代码、制作游戏，运行、测试、修改，保留工作区。
2. 独立图形桌面或虚拟手机，让 AI 在里面使用 QQ、浏览器、游戏，不占用真实荣耀手机的屏幕。
3. 黑金 UI；清楚说明每个开关用途；响应等待计时；具体错误位置与修复步骤。
4. 用户不熟悉终端，尽量减少手工步骤；不能把准备了按钮、下载了工具或模型自述当成安装成功。

## 当前真实状态

源码版本为 0.3.1-test，versionCode 4。本次交接没有实现新版图形桌面或安卓虚拟机。releases/ 内为现有已构建的 0.3.1 APK 和 Linux 修复安装脚本。

- 本机操作：PhoneService 无障碍服务，读取真实屏幕、截图、点击、滑动、输入。不是虚拟手机。
- Linux：LinuxBridge 通过 Termux RUN_COMMAND 调用 PRoot-Distro 的 xiaoxing Debian 容器。独立工作目录 /root/xiaoxing-workspace。
- 系统命令：Android 普通 App 权限下的 sh，10 秒限制；不能当作 Debian 终端。
- App 文件工具有另一个应用内部工作区，与 Linux 工作区不同。
- 有单文件 HTML WebView 预览和内置游戏测试场；这也不是完整虚拟电脑。
- 有 API 诊断、工具轮数/任务时限、停止、计时；没有全天候 QQ 消息监听或自主群聊。
- 模型密钥由用户在手机填写，Android Keystore 加密保存。用户目前截图显示 LongCat；另有上下文说已准备 DeepSeek API，不应擅自清空或更换配置。

## 安装失败的证据与修复情况

用户日志：Termux Python、proot、proot-distro 5.10.3 已装好；下载 debian:bookworm 的 Docker Hub 匿名认证连接反复 SSL UNEXPECTED_EOF_WHILE_READING，最终失败。
App 工具返回 Linux 退出码 1，container 'xiaoxing' is not installed，说明桥接能调用，但容器未安装。

0.3.1 的 assets/setup-linux.sh 改用 mirror.gcr.io/library/debian:bookworm；会保留已有容器、分阶段报错、检查 Python/Node/Git，成功才显示完成。曾在开发环境下载验证 Google 缓存 ARM64 镜像层，但尚无用户手机安装成功证据。不能声称已替用户装好。

## 下一步建议（尚未实现）

先实测/修复 Linux 容器启动，再实现独立 Linux 图形桌面：Debian + Xfce + TigerVNC + noVNC/websockify。这是共享 Android 内核的 PRoot Linux 桌面，不是 Windows，也不是 Android 客体系统。

必须解决：现有 LinuxCommands.RUNNER 每次命令结束会 kill 整个进程组，PRoot 本身也可能清理子进程。不能简单 linux_exec 启动后台 VNC/QQ 后就报告运行中。桌面需独立、可停止、可检测的长运行 Termux 服务会话；启动失败要回显日志。

桌面建议只监听本机环回接口，设置随机访问密码；App 内查看器保持 file/content access 关闭，不给网页 Java 桥。若开放 localhost HTTP，network-security-config 仅放行所需本机地址，API 仍强制 HTTPS。

AI 操作独立桌面需独立截图、点击、输入工具，明确区分本机屏幕。截图后再操作，动作后验证，不能宣称实时动作游戏稳定可玩。

QQ 优先核实腾讯官方 Linux ARM64 软件包。已发现旧的 /linuxqq/download.html 仍指向 2020 旧配置；新版 https://im.qq.com/linuxqq/index.shtml 使用 //cdn-go.cn/qq-web/im.qq.com_new/latest/rainbow/linuxConfig.js，需重新读取官方当前下载地址和架构，不要拿第三方旧版当最新。尚未下载/安装/启动 QQ；登录由用户手动完成。

独立 Android 虚拟手机是另一需求，不能把 PRoot 或 Linux 桌面冒充成安卓模拟器。手机本地模拟器/云手机需要另行核实兼容、费用和可控制接口。不能擅自购买服务。

群友截图是 TRAE「云端」工作区的 Android SDK 大小清单（build-tools、cmdline-tools、platforms、platform-tools 等），没有 emulator/system-images 的证据，不能据此认定群友已经有可玩 QQ 的安卓虚拟机。

## 构建与验证

build.sh 使用 Android SDK 35 的 android.jar、build-tools 和 JDK；无需 Gradle。README 有构建命令。源码中 tests/ 有 JVM、Python、游戏 JS 检查。

已有验证：0.3.1 可编译、打包、签名；纯代码测试和模拟 Termux 测试见 VALIDATION。未在荣耀 80 或 Android 模拟器上完整实测；上一环境无 /dev/kvm，模拟器启动失败，不能声称原生 UI 测试通过。

本次迁移尝试补开发依赖，但尚未完成；自动审批服务曾因额度问题拒绝执行一次下载命令，不是手机本身问题。恢复工作后先检查当前环境，不假设 /tmp 的工具链仍存在。

## 签名与保密

公开仓库不包含 build/development.jks、私有签名备份、模型 Key、编译缓存。旧安装包签名证书 SHA256：805a55311d7d8462f84a2d704fdc4b3183a32ca077e770ebda059db11a1d42d0。
用户此前单独保存过 Xiaoxing-Agent-private-signing-backup.zip。覆盖升级需同一签名；不要悄悄换签名，也不要建议先卸载以免丢配置和工作区。需要签名备份时让用户通过私有文件提供，不能提交到公开仓库。

验收时分别报告：源码已实现、构建已通过、开发环境已验证、用户手机已验证。不要合并成一句“全装好了”。
