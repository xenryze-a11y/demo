FROM --platform=linux/arm64 mirror.gcr.io/library/debian@sha256:b8dee49b29a16c89f0781356ccb07cbf6c5195dace2e6e1b6a42f4c9af1e55fa
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get -o Acquire::Retries=3 update && apt-get -o Acquire::Retries=3 install -y --no-install-recommends \
    xfce4-session xfce4-panel xfwm4 xfdesktop4 thunar xfce4-terminal mousepad netsurf-gtk \
    tigervnc-standalone-server tigervnc-tools dbus-x11 xdotool xclip scrot novnc \
    python3-websockify fonts-noto-cjk curl ca-certificates procps python3-venv git \
 && find /usr/share/locale -mindepth 1 -maxdepth 1 ! -name zh_CN ! -name zh_TW ! -name en ! -name en_GB ! -name locale.alias -exec rm -rf {} + \
 && find /usr/share/doc -type f ! -iname 'copyright*' ! -iname 'license*' ! -iname 'copying*' -delete \
 && find /usr/share/fonts/opentype/noto -type f ! -name NotoSansCJK-Regular.ttc -delete \
 && rm -rf /usr/share/man /usr/share/info /usr/share/doc-base /var/lib/apt/lists/* /var/cache/apt/archives/* /var/log/* \
 && printf 'Xiaoxing offline desktop 0.5.0\nDebian bookworm arm64\n' > /etc/xiaoxing-desktop-image
