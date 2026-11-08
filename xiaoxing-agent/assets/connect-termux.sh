# Only the first connection needs this host-side setting. No Linux/SDK download here.
bash <<'XIAOXING_CONNECT'
set -e
mkdir -p "$HOME/.termux"
touch "$HOME/.termux/termux.properties"
if grep -q '^allow-external-apps=' "$HOME/.termux/termux.properties"; then
  sed -i 's/^allow-external-apps=.*/allow-external-apps=true/' "$HOME/.termux/termux.properties"
else
  printf '\nallow-external-apps=true\n' >> "$HOME/.termux/termux.properties"
fi
termux-reload-settings || true
pkg install -y python proot-distro curl
printf '\nTermux 宿主连接准备完成。回小星授予运行命令权限，然后点「安装并启动内置独立电脑」。\n'
XIAOXING_CONNECT
