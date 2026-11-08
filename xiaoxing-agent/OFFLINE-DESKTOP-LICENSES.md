# 离线电脑系统的软件来源与许可证

小星 0.5.0 完整版的 `assets/offline/desktop-arm64.tar.xz` 是 Debian Bookworm ARM64 根文件系统，安装了 Xfce、TigerVNC、noVNC、Websockify、NetSurf、Mousepad、Thunar、Python、Node 和 Git 等软件。它不包含腾讯 QQ、用户账号、模型密钥或签名私钥。

- 原始系统取自 Debian 官方镜像的 Google 管理镜像缓存：`mirror.gcr.io/library/debian:bookworm`。下载的 OCI 清单与镜像层均以 SHA-256 校验。
- 后续软件来自 Debian Bookworm / security 官方签名软件源。
- 精确二进制软件包、版本与架构见 `assets/offline-desktop.packages.txt`。
- 对应源码包、版本与下载入口见 `assets/offline-desktop.sources.txt`；通过 Debian Snapshot 页面可以下载该版本的源码归档、补丁与 `.dsc`。这些软件的对应源码可按列表从公开 Debian 源取得；列表随源码和安装包提供。
- 每个软件包的版权与许可证保留在离线系统 `/usr/share/doc/<包名>/copyright`，通用许可证在 `/usr/share/common-licenses/`。用户可在独立电脑内查看、复制或导出。
- 为降低手机存储占用，系统精简了非中英文翻译、额外字体、手册与非许可证文档，以及 apt 缓存/日志；版权文件保留。可通过 Debian 软件源重新安装这些附加资源。
- Xfce / TigerVNC / NetSurf 等使用各自的 GPL/LGPL 等许可证，noVNC 使用 MPL-2.0，Websockify 使用 LGPL-3.0 等；以各软件包内的版权与许可证文件为准。
- `assets/install-linux-qq.sh` 只提供从腾讯官方 HTTPS 下载并安装 Linux QQ 的流程，官方地址来源于腾讯 `https://im.qq.com/linuxqq/index.shtml` 所引用的 `linuxConfig.js`，于 2026-11-08 核对。QQ 本体不随本系统分发；账号登录由用户手动完成。

应用自己的 Java/Python 源码在 `assets/self-source.zip`。第三方系统镜像不重复塞进源码 ZIP，后续修改 App 时可继续使用已安装的电脑系统；重建完整离线 APK 时，从 GitHub Release 获取对应 SHA-256 的系统包，或参考 `tools/offline-desktop/` 重新构建系统。
