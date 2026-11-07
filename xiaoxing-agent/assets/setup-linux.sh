# Paste this entire block in Termux, then press Enter.
bash <<'XIAOXING_SETUP'
set -Ee
XIAOXING_STAGE='检查已安装的工具'
XIAOXING_CONFIG_DIR="${XIAOXING_CONFIG_DIR:-$HOME/.termux}"
trap 'code=$?; printf "\n【尚未安装完成】失败阶段：%s\n已装好的部分会保留，不需要重装 Termux 或修改模型密钥。\n请把本段上方的错误连同这一行截图。退出码：%s\n" "$XIAOXING_STAGE" "$code"; exit "$code"' ERR
printf '\n【1/4】检查工具，保留已有安装…\n'
if ! command -v proot-distro >/dev/null || ! command -v python >/dev/null; then
  pkg update -y
  pkg install -y proot-distro python coreutils
fi
mkdir -p "$XIAOXING_CONFIG_DIR"
touch "$XIAOXING_CONFIG_DIR/termux.properties"
if grep -q '^allow-external-apps=' "$XIAOXING_CONFIG_DIR/termux.properties"; then
  sed -i 's/^allow-external-apps=.*/allow-external-apps=true/' "$XIAOXING_CONFIG_DIR/termux.properties"
else
  printf '\nallow-external-apps=true\n' >> "$XIAOXING_CONFIG_DIR/termux.properties"
fi
termux-reload-settings || true
XIAOXING_STAGE='下载 Debian 系统镜像'
printf '\n【2/4】安装 Debian 系统，使用另一镜像入口…\n'
if proot-distro login xiaoxing -- /bin/true >/dev/null 2>&1; then
  printf '已有容器可正常启动，跳过重新安装。\n'
else
  if proot-distro list --quiet 2>/dev/null | grep -qx 'xiaoxing'; then
    printf '名为 xiaoxing 的容器存在但启动失败。保留其中数据，不会自动覆盖。\n'
    proot-distro login xiaoxing -- /bin/true
  fi
  if ! proot-distro install --help 2>&1 | grep -q -- '--name'; then
    printf '需要 PRoot-Distro 5.x，请先在 Termux 执行 pkg upgrade proot-distro 再重试。\n'
    false
  fi
  proot-distro install --name xiaoxing mirror.gcr.io/library/debian:bookworm
fi
XIAOXING_STAGE='安装 Python、Node 和 Git 开发工具'
printf '\n【3/4】安装开发工具，网络下载可能需要数分钟…\n'
proot-distro login xiaoxing -- /bin/bash -lc '
  set -e
  export DEBIAN_FRONTEND=noninteractive
  apt-get -o Acquire::Retries=3 update
  apt-get -o Acquire::Retries=3 install -y python3 python3-venv python3-pip nodejs npm git curl ca-certificates procps
  mkdir -p /root/xiaoxing-workspace
  cd /root/xiaoxing-workspace
  python3 -c "assert sum(range(101)) == 5050; print(\"PYTHON_OK 5050\")"
  node -e "console.log(\"NODE_OK\", 1+2+3)"
  git --version
'
XIAOXING_STAGE='最终检查'
printf '\n【4/4】检查容器启动…\n'
proot-distro login xiaoxing -- /bin/true
printf '\n✅ 小星开发环境安装完成 / Setup complete\n现在回到小星，点 Linux → 检测 Python / Node / Git。\n'
XIAOXING_SETUP
