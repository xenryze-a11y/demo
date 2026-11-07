package app.xen.xiaoxing;

import android.app.PendingIntent;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.*;
import java.util.*;
import java.util.concurrent.*;

final class LinuxBridge {
    static final String PERMISSION="com.termux.permission.RUN_COMMAND";
    static final String PREFIX="/data/data/com.termux/files/usr/bin/";
    private static final Map<String,CompletableFuture<Bundle>> pending=new ConcurrentHashMap<>();
    private static volatile String active;
    private static volatile Context owner;
    static boolean installed(Context c){try{c.getPackageManager().getPackageInfo("com.termux",0);return true;}catch(Exception e){return false;}}
    static boolean granted(Context c){return c.checkSelfPermission(PERMISSION)==PackageManager.PERMISSION_GRANTED;}
    static String status(Context c){return !installed(c)?"尚未安装 Termux":!granted(c)?"Termux 已安装 · 等待运行命令授权":"Termux 已安装且已授权 · 请检测容器";}
    static String execute(Context ctx,String command,int seconds)throws Exception {
        return execute(ctx,command,seconds,false);
    }
    static String executeNative(Context ctx,String command,int seconds)throws Exception {
        return execute(ctx,command,seconds,true);
    }
    private static String execute(Context ctx,String command,int seconds,boolean nativeTermux)throws Exception {
        Context c=ctx.getApplicationContext();
        if(!installed(c))throw new Exception("请先到 Linux 面板安装 Termux，并运行初始化指令。");
        if(!granted(c))throw new Exception("请在 Linux 面板授予「在 Termux 环境中运行命令」权限。");
        String token=UUID.randomUUID().toString();CompletableFuture<Bundle> f=new CompletableFuture<>();pending.put(token,f);active=token;owner=c;
        Intent result=new Intent(c,LinuxResultReceiver.class).setAction(c.getPackageName()+".LINUX."+token);
        PendingIntent pi=PendingIntent.getBroadcast(c,token.hashCode(),result,PendingIntent.FLAG_ONE_SHOT|(Build.VERSION.SDK_INT>=31?PendingIntent.FLAG_MUTABLE:0));
        try{
            if(command==null||command.indexOf('\0')>=0||command.length()>24000)throw new Exception("命令为空、含空字符或过长");
            String prepared=nativeTermux?"mkdir -p \"$HOME/xiaoxing-workspace\" && cd \"$HOME/xiaoxing-workspace\" && "+command:LinuxCommands.containerCommand(command);
            Intent i=intent(PREFIX+"python",new String[]{"-c",LinuxCommands.RUNNER,token,String.valueOf(LinuxCommands.timeout(seconds)),prepared,nativeTermux?"termux":"debian"});
            i.putExtra("com.termux.RUN_COMMAND_PENDING_INTENT",pi);c.startService(i);
            long deadline=SystemClock.elapsedRealtime()+(LinuxCommands.timeout(seconds)+25)*1000L;
            while(!f.isDone()){
                if(!Agent.running){cancel();throw new Exception("Linux 等待已停止；已请求终止该命令进程组。");}
                if(SystemClock.elapsedRealtime()>deadline){cancel();throw new Exception("未收到 Termux 回传。检查 allow-external-apps=true、Termux 后台限制和初始化日志；远端命令自身有超时。");}
                try{f.get(250,TimeUnit.MILLISECONDS);}catch(TimeoutException ignored){}
            }
            Bundle b=f.get();int err=b.getInt("err",-1);
            if(err!=-1)throw new Exception("Termux 错误 "+err+"："+b.getString("errmsg","")+"。请查看 Termux 通知并确认已完成初始化。");
            return LinuxCommands.result(b.getInt("exitCode",-1),b.getString("stdout",""),b.getString("stderr",""));
        }catch(SecurityException e){throw new Exception("Termux 拒绝命令。需要同时授权 RUN_COMMAND，并在 Termux 开启 allow-external-apps=true。",e);}
        finally{pending.remove(token);pi.cancel();if(token.equals(active)){active=null;owner=null;}}
    }
    private static Intent intent(String path,String[] args){return new Intent("com.termux.RUN_COMMAND").setClassName("com.termux","com.termux.app.RunCommandService").putExtra("com.termux.RUN_COMMAND_PATH",path).putExtra("com.termux.RUN_COMMAND_ARGUMENTS",args).putExtra("com.termux.RUN_COMMAND_WORKDIR","/data/data/com.termux/files/home").putExtra("com.termux.RUN_COMMAND_BACKGROUND",true).putExtra("com.termux.RUN_COMMAND_COMMAND_LABEL","小星 Linux 任务");}
    static void cancel(){String token=active;Context c=owner;if(token==null||c==null)return;try{c.startService(intent(PREFIX+"bash",new String[]{"-lc",LinuxCommands.cancelCommand(token)}));}catch(Exception ignored){}}
    static void receive(Intent intent){String action=intent.getAction();if(action==null)return;int at=action.lastIndexOf('.');if(at<0)return;CompletableFuture<Bundle> f=pending.get(action.substring(at+1));Bundle result=intent.getBundleExtra("result");if(f!=null&&result!=null)f.complete(result);}
    static String setup(Context c)throws java.io.IOException {try(java.io.InputStream in=c.getAssets().open("setup-linux.sh")){java.io.ByteArrayOutputStream b=new java.io.ByteArrayOutputStream();byte[] p=new byte[4096];int n;while((n=in.read(p))!=-1)b.write(p,0,n);return b.toString("UTF-8");}}
}
