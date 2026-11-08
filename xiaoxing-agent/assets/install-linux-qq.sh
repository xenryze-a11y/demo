#!/bin/bash
set -Eeuo pipefail
export DEBIAN_FRONTEND=noninteractive
if dpkg-query -W -f='${Status}' linuxqq 2>/dev/null | grep -qx 'install ok installed'; then
    dpkg-query -W linuxqq
    printf '\nQQ 已安装。打开后请由用户接管并登录。\n'
    exit 0
fi
case "$(dpkg --print-architecture)" in
    arm64) qq_url='https://qqdl.gtimg.cn/qqfile/QQNTV2/9.9.35/release/1763096b/QQ_3.2.33_260902_arm64_01.deb';;
    amd64) qq_url='https://qqdl.gtimg.cn/qqfile/QQNTV2/9.9.35/release/1763096b/QQ_3.2.33_260902_amd64_01.deb';;
    *) printf '腾讯官方此版本不提供当前架构的软件包\n' >&2; exit 1;;
esac
# URLs verified against Tencent's official linuxConfig.js on 2026-11-08.
mkdir -p "$HOME/xiaoxing-workspace/packages"
qq_file="$HOME/xiaoxing-workspace/packages/tencent-linux-qq.deb"
printf '正在从腾讯官方下载 Linux QQ；保留 TLS 校验，下载可能较大…\n'
curl --proto '=https' --fail --location --show-error --retry 3 --retry-all-errors --connect-timeout 20 --max-time 600 "$qq_url" -o "$qq_file.part"
test "$(dpkg-deb -f "$qq_file.part" Architecture)" = "$(dpkg --print-architecture)"
case "$(dpkg-deb -f "$qq_file.part" Package)" in linuxqq|qq) ;; *) printf '下载的软件包标识不符合预期\n' >&2; exit 1;; esac
mv "$qq_file.part" "$qq_file"
apt-get -o Acquire::Retries=3 update
apt-get -o Acquire::Retries=3 install -y --no-install-recommends "$qq_file"
command -v qq
printf '\nLinux QQ 安装完成。请点打开 QQ，登录时使用「我来操作」。本脚本没有登录或发送消息。\n'
