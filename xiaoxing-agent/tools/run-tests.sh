#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${JSON_JAR:?Set JSON_JAR to an org.json JVM JAR (not android.jar stubs)}"
mkdir -p build/test-classes
javac --release 8 -cp "$JSON_JAR" -d build/test-classes \
  src/app/xen/xiaoxing/{FilesBox,WebTools,LoopbackTransfer,LinuxCommands,ApiClient,ApiDiagnostics}.java \
  tests/{FilesBoxTest,FileImportTest,WebToolsTest,LoopbackTransferTest,LinuxCommandsTest,ApiClientTest,WebLiveTest}.java
test_classpath="build/test-classes:$JSON_JAR"
java -cp "$test_classpath" FilesBoxTest
java -cp "$test_classpath" FileImportTest
java -cp "$test_classpath" app.xen.xiaoxing.WebToolsTest
java -cp "$test_classpath" app.xen.xiaoxing.LoopbackTransferTest
java -cp "$test_classpath" app.xen.xiaoxing.ApiClientTest
java -cp "$test_classpath" app.xen.xiaoxing.LinuxCommandsTest build/linux-runner.py
python3 tests/test_linux_runner.py build/linux-runner.py
python3 tests/test_setup_repair.py
python3 tests/test_agent_protocol.py "$JSON_JAR"
node tests/game-lab.test.cjs
bash -n build.sh assets/setup-{linux,desktop,android-build}.sh
if [ "${RUN_LIVE_WEB:-0}" = 1 ]; then java -cp "$test_classpath" app.xen.xiaoxing.WebLiveTest; fi
if [ "${RUN_LIVE_DESKTOP:-0}" = 1 ]; then python3 tests/test_desktop_live.py; fi
