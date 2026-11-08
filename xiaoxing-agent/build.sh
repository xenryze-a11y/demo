#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${ANDROID_JAR:?Set ANDROID_JAR to Android SDK platform 35 android.jar}"
: "${BUILD_TOOLS:?Set BUILD_TOOLS to Android SDK build-tools 35.0.0 directory}"
# Clean generated code only; keep the privately held signing keystores in build/.
rm -rf build/classes build/generated build/dex build/bundled-assets
mkdir -p build/classes build/generated build/dex dist
python3 tools/bundle-source.py build/bundled-assets/self-source.zip
variant="${BUILD_VARIANT:-unsigned}"
manifest=AndroidManifest.xml
if [ "$variant" = preview ] || [ "$variant" = personal ]; then
  python3 - "$variant" <<'PY'
import xml.etree.ElementTree as E
import sys
E.register_namespace('android','http://schemas.android.com/apk/res/android')
ns='{http://schemas.android.com/apk/res/android}'
t=E.parse('AndroidManifest.xml');r=t.getroot();original=r.attrib['package']
variant=sys.argv[1]
r.set('package',original+'.'+variant)
app=r.find('application');app.set(ns+'label','小星 Agent · 个人版' if variant=='personal' else '小星 Agent · 独立测试')
for e in app:
    name=e.get(ns+'name','')
    if name.startswith('.'):e.set(ns+'name',original+name)
t.write('build/preview-manifest.xml',encoding='utf-8',xml_declaration=True)
PY
  manifest=build/preview-manifest.xml
elif [ "$variant" != unsigned ] && [ "$variant" != release ]; then
  echo 'BUILD_VARIANT must be unsigned, preview, personal or release' >&2; exit 1
fi
"$BUILD_TOOLS/aapt2" compile --dir res -o build/resources.zip
"$BUILD_TOOLS/aapt2" link -o build/resources.apk -I "$ANDROID_JAR" --manifest "$manifest" --custom-package app.xen.xiaoxing -0 xz -A assets -A build/bundled-assets --java build/generated build/resources.zip
find src build/generated -name '*.java' > build/sources.txt
javac -encoding UTF-8 --release 8 -classpath "$ANDROID_JAR" -d build/classes @build/sources.txt
jar cf build/classes.jar -C build/classes .
"$BUILD_TOOLS/d8" --lib "$ANDROID_JAR" --min-api 26 --output build/dex build/classes.jar
python3 - <<'PY'
from zipfile import ZipFile,ZIP_DEFLATED
from pathlib import Path
with ZipFile('build/resources.apk') as src, ZipFile('build/unsigned.apk','w',ZIP_DEFLATED) as dst:
    for item in src.infolist():dst.writestr(item,src.read(item.filename))
    for path in Path('build/dex').glob('*.dex'):dst.write(path,path.name)
PY
if [ -x "$BUILD_TOOLS/zipalign" ]; then
    "$BUILD_TOOLS/zipalign" -f 4 build/unsigned.apk build/aligned.apk

else
    python3 tools/zipalign.py build/unsigned.apk build/aligned.apk
fi
if [ "$variant" = unsigned ]; then
    cp build/aligned.apk dist/Xiaoxing-Agent-0.5.0-unsigned.apk
    echo 'Compiled unsigned APK. Use the original signing key for an in-place update.'
    exit 0
fi
if [ "$variant" = preview ]; then
    if [ ! -f build/preview.jks ]; then
        keytool -genkeypair -keystore build/preview.jks -alias preview -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 3650 -dname 'CN=Xiaoxing Separate Preview' >/dev/null 2>&1
    fi
    SIGNING_KEY=build/preview.jks SIGNING_ALIAS=preview SIGNING_STORE_PASSWORD=android SIGNING_KEY_PASSWORD=android
elif [ "$variant" = personal ]; then
    personal_keys="${PERSONAL_KEY_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/xiaoxing-signing}"
    mkdir -p "$personal_keys"
    chmod 700 "$personal_keys"
    if [ ! -f "$personal_keys/personal.jks" ]; then
        keytool -genkeypair -keystore "$personal_keys/personal.jks" -alias personal -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 3650 -dname 'CN=Xiaoxing Personal Device' >/dev/null 2>&1
    fi
    SIGNING_KEY="$personal_keys/personal.jks" SIGNING_ALIAS=personal SIGNING_STORE_PASSWORD=android SIGNING_KEY_PASSWORD=android
else
    : "${SIGNING_KEY:?Provide the original private keystore; release never generates a replacement}"
    : "${SIGNING_ALIAS:?Set SIGNING_ALIAS}"
    : "${SIGNING_STORE_PASSWORD:?Set SIGNING_STORE_PASSWORD}"
    : "${SIGNING_KEY_PASSWORD:?Set SIGNING_KEY_PASSWORD}"
    export SIGNING_STORE_PASSWORD SIGNING_KEY_PASSWORD
    expected=805a55311d7d8462f84a2d704fdc4b3183a32ca077e770ebda059db11a1d42d0
    actual=$(keytool -exportcert -keystore "$SIGNING_KEY" -alias "$SIGNING_ALIAS" -storepass:env SIGNING_STORE_PASSWORD 2>/dev/null | sha256sum | cut -d ' ' -f 1)
    if [ "$actual" != "$expected" ]; then echo 'Signing certificate differs from the installed 0.3.1 APK; refusing in-place update.' >&2; exit 1; fi
fi
export SIGNING_STORE_PASSWORD SIGNING_KEY_PASSWORD
output="dist/Xiaoxing-Agent-0.5.0-$variant.apk"
"$BUILD_TOOLS/apksigner" sign --ks "$SIGNING_KEY" --ks-key-alias "$SIGNING_ALIAS" --ks-pass env:SIGNING_STORE_PASSWORD --key-pass env:SIGNING_KEY_PASSWORD --out "$output" build/aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose "$output"
sha256sum "$output"
