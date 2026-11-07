#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${ANDROID_JAR:?Set ANDROID_JAR to Android SDK platform 35 android.jar}"
: "${BUILD_TOOLS:?Set BUILD_TOOLS to Android SDK build-tools 35.0.0 directory}"
mkdir -p build/classes build/generated build/dex dist
"$BUILD_TOOLS/aapt2" compile --dir res -o build/resources.zip
"$BUILD_TOOLS/aapt2" link -o build/resources.apk -I "$ANDROID_JAR" --manifest AndroidManifest.xml -A assets --java build/generated build/resources.zip
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
"$BUILD_TOOLS/zipalign" -f 4 build/unsigned.apk build/aligned.apk
# Development key only. Preserve it privately to sign future updates of this build.
if [ ! -f build/development.jks ]; then
    keytool -genkeypair -keystore build/development.jks -alias development -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 3650 -dname 'CN=Xiaoxing Personal Test, O=Personal Development, C=CN' >/dev/null 2>&1
fi
"$BUILD_TOOLS/apksigner" sign --ks build/development.jks --ks-key-alias development --ks-pass pass:android --key-pass pass:android --out dist/Xiaoxing-Agent-0.3.1-test.apk build/aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose dist/Xiaoxing-Agent-0.3.1-test.apk
sha256sum dist/Xiaoxing-Agent-0.3.1-test.apk
