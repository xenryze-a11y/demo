# 0.3.1 安装修复验证

2026-11-08 北京时间

用户设备证据：Termux、Python、PRoot-Distro 5.10.3 已装好；小星可接收 Termux 回传；Docker Hub anonymous registry TLS 握手出现 UNEXPECTED_EOF_WHILE_READING，Debian 容器未安装。不能从截图判断断连由网络运营商、代理还是服务端造成。

本次修复：
- 初始化改用 mirror.gcr.io/library/debian:bookworm。
- 容器已安装且能启动时继续安装工具；已存在但不能启动时保留数据，不覆盖。
- 出错显示中文阶段与未完成提示，不输出最终成功标记。
- 缺失容器改为中文错误；非零退出码不作为成功结果。

验证：
- 从 Google 官方管理的 Docker Hub 缓存获取 ARM64 manifest 和完整系统镜像层。
- 下载大小：48,412,454 字节。镜像层 SHA-256：f59e747f549eda321051637e213896378a19033924e1bfa7ae23a6572729c23c。实际文件哈希与 registry manifest 一致，并核对 shell ELF 为 AArch64。
- 安装脚本使用模拟 Termux 工具检查：更换源、下载失败、开发工具安装失败、恢复已有容器、保护坏容器、配置幂等、未成功不输出 Setup complete。全部通过。该测试不等于荣耀 80 安装测试。
- Linux 命令/结果处理 12 项检查通过。
- bash -n、Java、资源编译、DEX、APK v2/v3 签名校验通过。

尚未验证：用户手机至新镜像入口的网络、手机上的真实容器安装与运行、独立虚拟手机/电脑、长期无人值守工作。不会声称这些已完成。

APK SHA-256：1109f295c7bb8c8176a09ca1084e45b2569e5a59d8e22bcf9a74f646ee16c3b6
