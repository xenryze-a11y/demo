# 小星 0.5.0：完整离线独立电脑交接

更新：2026-11-08（北京时间）。用户使用荣耀 80，目标始终是 AI 在后台用独立电脑/手机，能安装软件，实时共享画面，用户临时接管再交还。不能把“已有按钮/脚本”称为其手机已安装。

0.5 相比 0.4 的核心改变是：**完整 APK 里确有约 171 MiB 的 ARM64 Debian/Xfce 系统**，含浏览器、编辑器、文件管理器与工具，而非要求用户先跑一串桌面下载命令。首次 Termux 安全宿主连接/系统授权仍需手机用户完成。

## 实现与交付

- `SandboxInstallService` 前台准备/校验镜像，通过本机一次性文件桥传入 Termux；`sandbox_bootstrap.py` 安装新 `xiaoxing-desktop` 容器，保留旧 `xiaoxing`。回传错误、阶段与日志，只有实际桌面 API 返回就绪才成功。
- `desktop_server.py` 维持 Xvnc、共享认证 D-Bus、Xfce、noVNC、安装/命令任务与常驻 GUI。PRoot 的 Unix 凭据/长路径问题经 ARM64 实测发现并修复，使用 nonce-TCP + 私有 cookie 会话总线；普通 Linux 仍用私有 Unix 总线。
- 新 `desktop_install/apps/launch/exec/job/push/pull` 工具。软件安装和命令后台运行并返回真实状态、退出码；GUI 常驻用 launch。用户接管时暂停 AI 截图/动作/命令进程组，交还后重取截图。
- `SandboxActivity` 提供「我来操作」「交还 AI」「小窗观看」，实时查看不再占用 Agent.local，允许 AI 工作时打开。Android 画中画及展开接管代码已接入；荣耀真机表现待测。
- 电脑面板一个主入口安装并启动、状态与日志、查看/接管/小窗、官方 Linux QQ 安装/打开入口。旧 Linux 与 Android SDK 放在高级/可选区，使用电脑不依赖 Android SDK。
- 文件导入/传输上限 256 MiB，可读取本版完整 APK；源码 ZIP 不重复包含系统镜像，保留 SHA 清单与对应下载地址。
- `BUILD_VARIANT=personal` 在 Termux 私有固定目录保存用户自己生成的签名，初次用独立 personal 包名；后续修改可跨工程目录复用签名。首次 personal 与 preview 分开，需要单独配置/授权、先停止旧桌面，后续覆盖个人版。不要泄露该签名。

镜像 SHA-256：cbdee4c4c3594424ca9984b4146216e9ba1a5c30c7953efc783e819c644b16cc。镜像、完整 APK 与源码在 GitHub Release `xiaoxing-v0.5.0-test`，不把大二进制或私钥塞进 Git/源码 ZIP。下载与签名校验记录见 Release。

## 实测边界

428 个 ARM64 二进制包实际配置完成。最终离线归档经 PRoot-Distro 5.10.3 新建容器和 ARM64 启动验证；Xvnc/Xfce/noVNC 实际运行。通过任务 API 安装并打开 galculator，退出码 0；真实浏览器接管 ARM64 桌面，在 Mousepad 输入保存，再回读文件成功。其他接管/暂停/恢复/旧截图拒绝测试见 VALIDATION.md。

没有连接荣耀手机，没有真实 DeepSeek Key 调用，没有手机原生画中画/权限/后台实测。QQ 本体未预装、未登录或聊天；安装脚本从已核对腾讯官方 URL 获取对应 Linux 包。PRoot 是共享 Android 内核的 Linux 电脑，不是安卓虚拟手机，不宣称能运行 Android APK 或原生手游。

0.5 preview 继续使用 0.4 preview 同一签名，可覆盖其独立测试包。原 0.3.1 包证书为 805a55311d7d8462f84a2d704fdc4b3183a32ca077e770ebda059db11a1d42d0，原私钥仍未提供；不要悄悄换签或建议先卸载。

## 下一步

优先拿手机上的实际阶段/日志与画面验证：首次宿主连接 → 新容器解包 → 桌面就绪 → AI 操作 → 实时观看 → 接管/输入 → 交还 → 安装软件与后台恢复。只有用户给出实际运行证据才可称其手机已装好。若要求 Android APK，需要另外的安卓运行端；不要把 Linux 桌面换个名字冒充安卓客体。
