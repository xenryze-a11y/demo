# Paste this block in Termux, after the basic Linux initialization.
bash <<'XIAOXING_ANDROID_BUILD'
set -Ee
trap 'printf "\n安卓构建工具未装完；保留已有文件，请检查上方错误。\n" >&2' ERR
pkg update -y
pkg install -y openjdk-21 aapt2 d8 apksigner python curl coreutils
python <<'PY'
from pathlib import Path
from zipfile import ZipFile
import hashlib, urllib.request
root=Path.home()/'.local/share/xiaoxing-android'
root.mkdir(parents=True,exist_ok=True)
archive=root/'platform-35_r02.zip'
expected='0bb560a90a7a2cbd0dd8348224d518b638fe7949'
def valid():return archive.is_file() and hashlib.sha1(archive.read_bytes()).hexdigest()==expected
if not valid():
    temp=archive.with_suffix('.partial')
    with urllib.request.urlopen('https://dl.google.com/android/repository/platform-35_r02.zip',timeout=60) as response,temp.open('wb') as out:
        size=0
        while chunk:=response.read(1024*1024):
            size+=len(chunk)
            if size>70*1024*1024:raise RuntimeError('Unexpected download size')
            out.write(chunk)
    temp.replace(archive)
if not valid():raise RuntimeError('Google platform package checksum mismatch')
with ZipFile(archive) as z:
    data=z.read('android-35/android.jar')
    (root/'android.jar').write_bytes(data)
print('Android platform verified:',root/'android.jar')
PY
mkdir -p "$HOME/.config"
printf 'export ANDROID_JAR="%s/.local/share/xiaoxing-android/android.jar"\nexport BUILD_TOOLS="%s/bin"\n' "$HOME" "$PREFIX" > "$HOME/.config/xiaoxing-build.env"
for tool in java javac jar aapt2 d8 apksigner; do command -v "$tool"; done
printf '\n安卓构建工具安装完成。源码通过 termux_exec 在 Termux 原生环境构建，不能在 Debian 中运行这些 Android 二进制。\n示例：source "$HOME/.config/xiaoxing-build.env"; cd 工程目录; BUILD_VARIANT=preview bash build.sh\n覆盖旧版需要用户私下保管的原签名；不要卸载旧版。\n'
XIAOXING_ANDROID_BUILD
