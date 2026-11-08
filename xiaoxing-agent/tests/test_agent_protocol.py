"""Compile the real agent against tiny lifecycle doubles; pass an org.json JAR."""
from pathlib import Path
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
stubs = {
    'android/content/Context.java': '''package android.content;
import java.io.File;
public class Context {
 private final File files;public Context(File f){files=f;}public Context getApplicationContext(){return this;}
 public File getFilesDir(){return files;}public SharedPreferences getSharedPreferences(String name,int mode){return new SharedPreferences();}
 public void startForegroundService(Intent i){}public void stopService(Intent i){}public void startActivity(Intent i){}
}''',
    'android/content/SharedPreferences.java': '''package android.content;
public class SharedPreferences {
 public String getString(String k,String d){return k.equals("endpoint")?"https://api.deepseek.com/chat/completions":d;}
 public int getInt(String k,int d){return d;}public boolean getBoolean(String k,boolean d){return d;}
}''',
    'android/content/Intent.java': '''package android.content;
public class Intent {public static final int FLAG_ACTIVITY_NEW_TASK=1;public Intent(Context c,Class<?> t){}public Intent putExtra(String k,String v){return this;}public Intent addFlags(int n){return this;}}''',
    'android/os/SystemClock.java': '''package android.os;public class SystemClock {public static long elapsedRealtime(){return System.nanoTime()/1000000;}}''',
    'app/xen/xiaoxing/AppDoubles.java': '''package app.xen.xiaoxing;
import android.content.Context;import org.json.*;
class TaskService {}
class GamePreviewActivity {static String report(){return "not used";}}
class Secrets {static String get(Context c){return "sk-offline-protocol-test";}}
class SessionStore {static JSONArray saved;static void save(Context c,String name,JSONArray data){saved=new JSONArray(data.toString());}}
class LinuxBridge {static void cancel(){}static String execute(Context c,String cmd,int seconds){Agent.running=false;return "stopped in test";}static String executeNative(Context c,String cmd,int seconds){return execute(c,cmd,seconds);}}
class LinuxFiles {static String transfer(Context c,FilesBox b,String p,String t,boolean push,boolean nativeTermux,String... container){return "not used";}}
class SourceBundle {static String prepare(Context c,FilesBox b,String t){return "not used";}}
class DesktopBridge {static void cancelRequest(){}static String json(Context c,String p,JSONObject b)throws java.io.IOException{return "{}";}static String screenshot(Context c){return "not used";}}
class PhoneService {static PhoneService instance;void hideStop(){}void showStop(){}String call(String n,JSONObject a){return "not used";}}
'''
}
with tempfile.TemporaryDirectory(prefix='xiaoxing-protocol-') as directory:
    temp = Path(directory)
    files = []
    for name, text in stubs.items():
        path = temp / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        files.append(str(path))
    for name in ('Agent', 'ApiClient', 'ApiDiagnostics', 'FilesBox', 'WebTools', 'ConversationWindow', 'HumanControl'):
        files.append(str(root / 'src/app/xen/xiaoxing' / (name + '.java')))
    files.append(str(root / 'tests/AgentProtocolTest.java'))
    subprocess.run(['javac', '--release', '8', '-cp', sys.argv[1], '-d', str(temp / 'classes'), *files], check=True)
    subprocess.run(['java', '-cp', str(temp / 'classes') + ':' + sys.argv[1], 'app.xen.xiaoxing.AgentProtocolTest'], check=True)
