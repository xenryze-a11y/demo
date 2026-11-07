# 小星 Agent 0.4.0 交接

更新：2026-11-08（北京时间）。用户用荣耀 80，优先手机操作。源码在 `xenryze-a11y/demo` 的 `xiaoxing-agent-handoff` 基础上继续开发；本轮工作分支 `codex/xiaoxing-connectivity-files`。

## 本轮修复

- 原版只有图片选择器，无通用附件，也无网页工具。新增 ACTION_OPEN_DOCUMENT 文件导入、实际大小、64 MiB 上限、8 附件、文本分页、APK/ZIP 检查/提取/打包、原始字节导出。
- WebTools 匿名 HTTPS 搜索/网页读取，来源与错误可见；独立于 DeepSeek API。公网校验、逐次重定向检查、读超时/容量、取消；不携带 API Key。
- LoopbackTransfer + LinuxFiles 在 App、Debian、Termux 原生之间双向传文件；一次性随机令牌、本机监听、固定长度、容量与新目标检查、中断清理。
- APK 内置 self-source.zip；SourceBundle 提取完整可编辑源码，SELF-DEVELOPMENT 给出修改→传输→Termux 编译→取回→导出的流程。
- 新增 Termux 原生命令、手机 Android 构建工具初始化、纯 Python ZIP 对齐。官方 Termux 仓库当日已核对 aapt2 / d8 / apksigner / openjdk-21 可用；Platform 35 下载以 Google 元数据 SHA-1 校验。手机端安装与构建未真机验证。
- SessionStore 私有持久会话；中断保留完整工具组；停止后未执行工具明确标记；上下文压缩保留当前指令和最近完整工具组，不再整段清空。
- 独立 Xfce 桌面：单独持久 Termux 终端运行 Python 控制端，Xvnc/noVNC 仅环回监听，随机控制令牌、VNC 密码，截图后动作、动作后重新截图。中文通过 xclip 粘贴（普通窗口 ctrl+v、终端 ctrl+shift+v）。App 查看器无 Java 桥，禁止 file/content 访问。

## 验收边界

见 VALIDATION。真实联网与开发机 Xvnc/Xfce/noVNC、GUI 操作已实测；Android 资源/Java/DEX/签名构建需以本轮最终记录为准。API 使用模拟服务验证，没有用户真实 DeepSeek Key 的付费调用。没有荣耀 80 原生 UI、Termux RUN_COMMAND、安装器、后台保活的实测证据。

手机上的 Debian 初始安装仍沿用 0.3.1 修复，不应声称已经替用户装好。独立桌面需要用户在手机安装一次软件并启动单独终端；开发环境的桌面成功不等于手机已安装。

安卓虚拟手机尚未接入。PRoot Linux 桌面不是 Android 客体或 Windows VM。需用户提供已有云手机控制接口或电脑模拟器运行端再接，未购买服务。QQ 尚未安装/登录，无持续消息监听或自主群聊。不要把截图接口、SDK 或按钮当成已运行虚拟手机。

## 签名

仓库内没有原私钥。原证书 SHA-256：805a55311d7d8462f84a2d704fdc4b3183a32ca077e770ebda059db11a1d42d0。

本轮可交付独立包名 preview 测试 APK 和原包名 unsigned APK；不冒充可覆盖升级版。正式 release 模式要求提供原私钥并核对证书，不会自动换签名。用户以前保存过 `Xiaoxing-Agent-private-signing-backup.zip`，需要覆盖安装时请其私下提供；不要提交公开仓库。

## 后续优先级

1. 荣耀手机安装新版、真实 DeepSeek 工具调用及大小文件导入/导出验证。
2. Termux 原生构建工具与 App 文件传输真机验证，原私钥签名后覆盖升级。
3. 手机独立桌面安装、启动、中文输入及后台恢复验证；保留失败日志。
4. 用户选定运行端后接入独立 Android 虚拟手机。QQ 等安装和账号操作需要用户明确目标。
