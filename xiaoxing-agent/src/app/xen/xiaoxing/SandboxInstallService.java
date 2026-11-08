package app.xen.xiaoxing;

import android.app.*;
import android.content.*;
import android.os.IBinder;
import android.util.Base64;
import org.json.*;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import javax.net.ssl.HttpsURLConnection;

/** Installs the complete offline guest and checks the actual desktop process. */
public class SandboxInstallService extends Service {
    private volatile boolean cancelled;
    private LoopbackTransfer bridge;
    private PendingIntent callback;
    private static volatile boolean active;
    private Thread worker;
    public IBinder onBind(Intent intent){return null;}
    public static boolean active(){return active;}
    public static String status(Context c){return c.getSharedPreferences("desktop",0).getString("setup_state","尚未安装独立电脑，点「安装并启动」开始");}
    public int onStartCommand(Intent intent,int flags,int id){
        if(intent!=null&&"cancel".equals(intent.getAction())){if(!active){stopSelf();return START_NOT_STICKY;}cancelled=true;if(bridge!=null)bridge.close();new Thread(()->{try{DesktopBridge.json(this,"/setup/cancel",new JSONObject());}catch(Exception ignored){}}).start();return START_NOT_STICKY;}
        if(active)return START_NOT_STICKY;
        active=true;cancelled=false;NotificationManager nm=getSystemService(NotificationManager.class);nm.createNotificationChannel(new NotificationChannel("sandbox_setup","独立电脑安装与启动",NotificationManager.IMPORTANCE_LOW));
        update("准备安装独立电脑…");worker=new Thread(()->{try{install();}catch(Exception e){update((cancelled?"安装已取消：":"安装未完成：")+(e.getMessage()==null?e.getClass().getSimpleName():e.getMessage()));}finally{if(bridge!=null)bridge.close();if(callback!=null)callback.cancel();active=false;stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}},"xiaoxing-offline-setup");worker.start();return START_NOT_STICKY;
    }
    private void update(String state){
        getSharedPreferences("desktop",0).edit().putString("setup_state",state).apply();
        PendingIntent open=PendingIntent.getActivity(this,61,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent stop=PendingIntent.getService(this,62,new Intent(this,SandboxInstallService.class).setAction("cancel"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n=new Notification.Builder(this,"sandbox_setup").setSmallIcon(R.drawable.ic_star).setContentTitle("小星独立电脑").setContentText(state.length()>100?state.substring(0,100):state).setContentIntent(open).setOngoing(true).addAction(new Notification.Action.Builder(null,"取消安装",stop).build()).build();startForeground(2,n);
    }
    private void install()throws Exception {
        if(!LinuxBridge.installed(this)||!LinuxBridge.granted(this))throw new IOException("先安装 Termux 并授予运行命令权限");
        try{JSONObject state=new JSONObject(DesktopBridge.json(this,"/status",null));if(state.optBoolean("running")){if(state.optInt("protocol",0)<2||!"xiaoxing-desktop".equals(getSharedPreferences("desktop",0).getString("container","")))throw new Exception("旧版桌面还在运行，请先保存文件并停止旧桌面，再安装新版独立电脑");getSharedPreferences("desktop",0).edit().putBoolean("offline_installed",true).apply();update("独立电脑已在运行，可以直接查看画面或接管");return;}}catch(IOException ignored){}
        try{JSONObject setup=new JSONObject(DesktopBridge.json(this,"/setup/status",null));String phase=setup.optString("phase");if(!"failed".equals(phase)&&!"cancelled".equals(phase)&&!"stopped".equals(phase)){update("恢复查看此前的安装状态…");waitUntilReady();return;}}catch(IOException ignored){}
        if(getSharedPreferences("desktop",0).getBoolean("offline_installed",false)){
            prepareCallback();update(DesktopBridge.launch(this,callback));waitUntilReady(60);return;
        }
        if(!android.os.Build.SUPPORTED_ABIS[0].startsWith("arm64"))throw new IOException("此离线系统面向 ARM64 手机；当前设备架构不匹配");
        JSONObject manifest=new JSONObject(DesktopBridge.asset(this,"offline-desktop.json"));String expected=manifest.getString("sha256");
        File image=new File(getCacheDir(),"xiaoxing-desktop-arm64.tar.xz");
        if(!image.isFile()||!hash(image).equals(expected)){
            if(getFilesDir().getUsableSpace()<2L*1024*1024*1024)throw new IOException("首次准备独立电脑请至少留出 2 GiB 空间，已有文件未改动");
            update("正在从安装包准备完整独立电脑系统…");File partial=new File(getCacheDir(),"desktop-image.part");
            try(InputStream in=imageStream(manifest);OutputStream out=new FileOutputStream(partial)){byte[] b=new byte[65536];int n;long size=0;while((n=in.read(b))!=-1){if(cancelled)throw new IOException("准备系统包已取消");size+=n;if(size>256L*1024*1024)throw new IOException("系统包超过容量限制");out.write(b,0,n);}}
            catch(Exception e){partial.delete();throw e;}
            if(!hash(partial).equals(expected)){partial.delete();throw new IOException("系统包 SHA-256 校验失败，请重新下载完整安装包");}
            if(image.exists()&&!image.delete())throw new IOException("无法替换损坏的缓存系统包");if(!partial.renameTo(image))throw new IOException("无法保存离线系统包");
        }
        if(cancelled)throw new IOException("安装已取消");
        DesktopBridge.configure(this,"xiaoxing-desktop");android.content.SharedPreferences prefs=getSharedPreferences("desktop",0);
        prepareCallback();
        bridge=new LoopbackTransfer(image,false,()->!cancelled,600000);
        String bootstrap=Base64.encodeToString(DesktopBridge.asset(this,"sandbox_bootstrap.py").getBytes("UTF-8"),Base64.NO_WRAP);
        String server=Base64.encodeToString(DesktopBridge.asset(this,"desktop_server.py").getBytes("UTF-8"),Base64.NO_WRAP);
        String code="import base64;exec(compile(base64.b64decode('"+bootstrap+"'),'xiaoxing-setup','exec'))";
        String command="set -e\ncommand -v python >/dev/null && command -v proot-distro >/dev/null && command -v curl >/dev/null || pkg install -y python proot-distro curl\n"+
            "mkdir -p \"$HOME/.local/share/xiaoxing-desktop-setup\"\n"+
            "curl --fail --silent --show-error --noproxy 127.0.0.1 --max-time 600 "+LinuxCommands.quote(bridge.url())+" -o \"$HOME/.local/share/xiaoxing-desktop-setup/image.tar.xz.part\"\n"+
            "mv \"$HOME/.local/share/xiaoxing-desktop-setup/image.tar.xz.part\" \"$HOME/.local/share/xiaoxing-desktop-setup/image.tar.xz\"\n"+
            "exec python -c "+LinuxCommands.quote(code)+" --image \"$HOME/.local/share/xiaoxing-desktop-setup/image.tar.xz\" --sha256 "+expected+" --port "+prefs.getInt("setup_port",0)+" --desktop-port "+prefs.getInt("port",0)+" --token "+prefs.getString("token","")+" --server "+LinuxCommands.quote(server);
        update("正在初始化 Termux 并传入离线系统；请保留终端会话");DesktopBridge.foreground(this,command,"小星独立电脑安装 · 保持此会话",callback);
        long until=System.nanoTime()+610000000000L;while(!bridge.result.isDone()){if(cancelled)throw new IOException("传输已取消");checkHostError();if(System.nanoTime()>until)throw new IOException("Termux 未接收系统包；请先点「首次连接 Termux」完成宿主设置，并检查终端安装日志");Thread.sleep(250);}bridge.await();
        update("离线系统传输完成，正在解包和启动桌面…");waitUntilReady();
    }
    private void waitUntilReady()throws Exception {
        waitUntilReady(1250);
    }
    private void waitUntilReady(int seconds)throws Exception {
        long until=System.nanoTime()+seconds*1000000000L;String last="";
        while(!cancelled&&System.nanoTime()<until){
            checkHostError();
            try{JSONObject state=new JSONObject(DesktopBridge.json(this,"/status",null));if(state.optBoolean("running")){getSharedPreferences("desktop",0).edit().putBoolean("offline_installed",true).apply();update("独立电脑已就绪：已检测到实际桌面进程，点查看画面即可使用");return;}}catch(IOException ignored){}
            try{JSONObject state=new JSONObject(DesktopBridge.json(this,"/setup/status",null));String message=state.optString("message","");if(!message.equals(last)){last=message;update(message);}if("failed".equals(state.optString("phase"))||"cancelled".equals(state.optString("phase")))throw new Exception(message+"\n"+state.optString("log",""));}catch(IOException ignored){}
            Thread.sleep(1500);
        }
        throw new IOException(cancelled?"已请求取消；现有数据保留":"桌面未在时限内就绪；请打开安装日志查看具体阶段");
    }
    private void prepareCallback(){android.content.SharedPreferences prefs=getSharedPreferences("desktop",0);String nonce=java.util.UUID.randomUUID().toString();prefs.edit().putString("setup_request",nonce).remove("setup_error").apply();Intent result=new Intent(this,SandboxSetupReceiver.class).setAction(getPackageName()+".SETUP."+nonce);callback=PendingIntent.getBroadcast(this,63,result,PendingIntent.FLAG_ONE_SHOT|(android.os.Build.VERSION.SDK_INT>=31?PendingIntent.FLAG_MUTABLE:0));}
    private void checkHostError()throws IOException {String error=getSharedPreferences("desktop",0).getString("setup_error","");if(!error.isEmpty()){if(error.contains("xiaoxing-desktop")&&(error.contains("not installed")||error.contains("does not exist")))getSharedPreferences("desktop",0).edit().putBoolean("offline_installed",false).apply();throw new IOException(error);}}
    private InputStream imageStream(JSONObject manifest)throws Exception {
        try{return getAssets().open("offline/desktop-arm64.tar.xz");}catch(FileNotFoundException missing){
            URL url=WebTools.validate(manifest.getString("url"));HttpsURLConnection c=(HttpsURLConnection)url.openConnection();c.setConnectTimeout(20000);c.setReadTimeout(60000);if(c.getResponseCode()!=200){c.disconnect();throw new IOException("离线系统下载失败，请使用包含完整系统的安装包");}return new FilterInputStream(c.getInputStream()){public void close()throws IOException{try{super.close();}finally{c.disconnect();}}};
        }
    }
    private static String hash(File file)throws Exception {MessageDigest digest=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(file)){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)digest.update(b,0,n);}StringBuilder out=new StringBuilder();for(byte b:digest.digest())out.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return out.toString();}
    @Override public void onDestroy(){cancelled=true;if(bridge!=null)bridge.close();super.onDestroy();}
}
