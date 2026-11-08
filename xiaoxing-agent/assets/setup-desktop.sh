# Paste this block in Termux after the basic Debian environment is installed.
bash <<'XIAOXING_DESKTOP_SETUP'
set -Ee
trap 'printf "\n独立桌面尚未安装完成，请保留上方错误；没有覆盖已有工作区。\n" >&2' ERR
proot-distro login xiaoxing -- /bin/bash -lc '
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get -o Acquire::Retries=3 update
apt-get -o Acquire::Retries=3 install -y xfce4 xfce4-terminal tigervnc-standalone-server tigervnc-tools dbus-x11 xdotool xclip scrot novnc python3-websockify fonts-noto-cjk
for tool in Xtigervnc tigervncpasswd xdotool xclip scrot websockify dbus-run-session xfce4-session; do command -v "$tool"; done
test -f /usr/share/novnc/vnc.html
'
printf '\n独立 Linux 桌面软件安装完成。回小星点“启动独立桌面”，再点“检测 / 查看”。\n这不是 Android 虚拟手机；没有安装 QQ，也不会自动登录或发送消息。请预留至少额外 2 GiB 空间。\n'
XIAOXING_DESKTOP_SETUP
