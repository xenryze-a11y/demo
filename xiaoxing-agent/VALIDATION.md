# 0.4.0 验证记录

2026-11-08，北京时间。验证范围为本次开发环境；以下分别标明真实联网、真实 Linux GUI、模拟 API/Android 与未验证项。

## 已验证的功能

- **真实联网**：执行实际 WebTools Java 客户端，Bing RSS 搜索返回来源链接，读取 DeepSeek 官方 HTTPS 文档得到 HTTP 200 和可读正文；没有使用模型 Key。开发机使用其提供的网络代理及 CA 信任，APK 使用 Android 系统 TLS 信任。
- **真实 Linux 图形桌面**：实际启动 TigerVNC Xvnc、Xfce、noVNC/websockify；验证 noVNC HTML、RFB 握手、令牌与 Origin 拒绝、截图 PNG、坐标点击、剪贴板中英文输入、Return 按键、GUI 输入结果落盘与回读、停止与进程退出。直接 xdotool 中文输入曾丢字，现改用 xclip 后，中英混合字符串完整回读通过。
- **文件**：旧 FilesBox 12 项检查；新导入/归档 28 项检查，包括真实大小、较大中文文本分页、二进制与非法 UTF-8、容量超限清理、取消、ZIP 目录/文本、提取/打包、拒绝覆盖、路径越界、展开过大和符号链接。
- **网络边界**：WebTools 30 项离线检查，另用真实 RSS 样本解析通过；覆盖内网/环回/元数据地址、非 HTTPS、带密码 URL、非 443、跨域重定向到内网、HTTP 429、PDF、取消、正文截断和 XML 实体声明。
- **二进制传输**：9 项实际本机 socket 检查，验证环回绑定、随机路径、512 KiB 随机二进制 GET/PUT 字节相等、禁止覆盖、错误令牌和中断后清理。未把它当成手机 Termux 权限已通过。
- **真实 Agent 循环 + 模拟 HTTPS/Android 生命周期**：106 项检查。真实 FilesBox 读取用户附件；工具 schema 包含网页工具；写文件后模拟 429；恢复保存上下文再继续；停止后未执行工具保留明确结果；图片不落盘；长上下文保留当前指令和完整工具组。无真实模型付费调用。
- **原有 API 诊断**：34 项离线检查，401/429/502/非 JSON/超时/停止和密钥脱敏通过。
- **命令与安装**：Linux 引号/路径/退出码 12 项检查；实际子进程监督测试覆盖输出截断、超时、进程组终止和缓存清理；基础安装脚本通过模拟下载失败、已有容器保留、错误阶段和配置幂等检查。游戏训练场 DOM fixture 通过。

## 构建验证

使用 Google 官方 Android Platform 35 r02 与 Build Tools 35.0.0，下载前核对官方仓库元数据，下载后验证校验和；JDK 21。

最终交付检查包括资源编译、Java 编译、DEX、4 字节对齐、preview APK v2/v3 签名校验、包名和版本核对。preview 使用独立包名和独立证书，原包名 unsigned 不伪装已签名升级版。

APK 中的 assets/self-source.zip 包含 src/res/assets/tools/tests、manifest、构建脚本与文档，不包含 keystore、模型密钥、构建目录或旧 APK；需从 APK 提取该源码到全新目录再构建 unsigned，验证交接包可复建。发布文件 SHA-256 记录在 releases/SHA256SUMS.txt，避免把 APK 自身校验和递归打进源码包。

## 复现

在工程目录，设置 org.json JVM JAR（例如 Maven Central 的 org.json:json:20250517）：

```sh
JSON_JAR=/path/json.jar bash tools/run-tests.sh
RUN_LIVE_WEB=1 JSON_JAR=/path/json.jar bash tools/run-tests.sh
# 先安装 setup-desktop.sh 对应的 Linux 软件，再运行：
python3 tests/test_desktop_live.py /path/desktop-proof.png
```

桌面集成测试只在当前 Linux 环境操作自己的测试窗口，不登录账号、不发消息。它不启动 Android 虚拟手机。

## 尚未验证

- 荣耀 80 上新 APK 的选择器/多文件导入/原始导出、进程重启恢复、无障碍、Termux RUN_COMMAND 与双向传输、系统安装器及后台策略。
- 手机基础 Debian 镜像安装、桌面软件安装、Termux 原生 APK 构建。已核对官方 Termux 软件包存在，但开发机 x86_64 构建不等于手机 ARM64 构建通过。
- 真实用户 DeepSeek Key 的工具调用、视觉模型权限、服务商实际限额；现有配置不会被本轮源码改动清空。
- Android 原生 UI 自动化：当前没有 /dev/kvm，可用遗留 ARM 模拟器为 25.2.5，系统镜像最高 API 23，低于本应用 minSdk 26，不能用于安装运行此 APK。未声称原生 UI 已验证。
- 原签名覆盖升级：没有原私钥。原 0.3.1 证书应为 805a55311d7d8462f84a2d704fdc4b3183a32ca077e770ebda059db11a1d42d0。
- 独立安卓虚拟手机、QQ 安装/登录/聊天、原生手游、长期后台机器人，均未接入或验证。
