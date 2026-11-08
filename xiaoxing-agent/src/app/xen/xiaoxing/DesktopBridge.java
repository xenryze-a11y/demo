package app.xen.xiaoxing;

import android.content.*;
import android.util.Base64;
import org.json.*;
import java.io.*;
import java.net.*;
import java.security.SecureRandom;

/** A separate Termux terminal owns the desktop lifetime, not linux_exec's supervisor. */
final class DesktopBridge {
    private static volatile HttpURLConnection connection;
    static void cancelRequest(){HttpURLConnection c=connection;if(c!=null)c.disconnect();}
    static String asset(Context c,String name)throws IOException {
        try(InputStream in=c.getAssets().open(name)){ByteArrayOutputStream b=new ByteArrayOutputStream();byte[] p=new byte[4096];int n;while((n=in.read(p))!=-1)b.write(p,0,n);return b.toString("UTF-8");}
    }
    static String launch(Context c)throws Exception {
        return launch(c,null);
    }
    static String launch(Context c,android.app.PendingIntent result)throws Exception {
        if(!LinuxBridge.installed(c)||!LinuxBridge.granted(c))throw new IOException("先完成 Termux 初始化与命令授权，再安装独立桌面软件");
        try{JSONObject status=new JSONObject(json(c,"/status",null));return status.optBoolean("running")?"独立桌面已经运行。可打开查看器。":"控制服务已连接，但桌面进程未就绪："+status.optString("log")+"。请停止桌面后重新启动。";}catch(IOException ignored){}
        String container=c.getSharedPreferences("desktop",0).getString("container","xiaoxing");configure(c,container);
        android.content.SharedPreferences config=c.getSharedPreferences("desktop",0);int port=config.getInt("port",0);String token=config.getString("token","");
        String code="import base64;exec(compile(base64.b64decode('"+Base64.encodeToString(asset(c,"desktop_server.py").getBytes("UTF-8"),Base64.NO_WRAP)+"'),'xiaoxing-desktop','exec'))";
        String command="exec proot-distro login "+LinuxCommands.quote(container)+" -- python3 -c "+LinuxCommands.quote(code)+" --port "+port+" --token "+token;
        foreground(c,command,"小星独立电脑 · 保持此会话",result);
        return "已请求在独立 Termux 终端启动桌面；请等待状态检测确认就绪。会话保持运行即可回小星查看、让 AI 操作或手动接管。";
    }
    static void configure(Context c,String container)throws IOException {
        if(!container.matches("[a-z0-9-]{1,40}"))throw new IOException("无效的独立电脑名称");
        byte[] random=new byte[32];new SecureRandom().nextBytes(random);StringBuilder token=new StringBuilder();for(byte b:random)token.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
        try(ServerSocket first=new ServerSocket(0,1,InetAddress.getByName("127.0.0.1"));ServerSocket second=new ServerSocket(0,1,InetAddress.getByName("127.0.0.1"))){
            c.getSharedPreferences("desktop",0).edit().putInt("port",first.getLocalPort()).putInt("setup_port",second.getLocalPort()).putString("token",token.toString()).putString("container",container).apply();
        }
        HumanControl.setUser(false);
    }
    static void foreground(Context c,String command,String label){
        foreground(c,command,label,null);
    }
    static void foreground(Context c,String command,String label,android.app.PendingIntent result){
        Intent i=new Intent("com.termux.RUN_COMMAND").setClassName("com.termux","com.termux.app.RunCommandService")
            .putExtra("com.termux.RUN_COMMAND_PATH",LinuxBridge.PREFIX+"bash").putExtra("com.termux.RUN_COMMAND_ARGUMENTS",new String[]{"-lc",command})
            .putExtra("com.termux.RUN_COMMAND_WORKDIR","/data/data/com.termux/files/home").putExtra("com.termux.RUN_COMMAND_BACKGROUND",false)
            .putExtra("com.termux.RUN_COMMAND_COMMAND_LABEL",label);
        if(result!=null)i.putExtra("com.termux.RUN_COMMAND_PENDING_INTENT",result);c.startService(i);
    }
    static String json(Context c,String path,JSONObject body)throws IOException {
        String value=new String(request(c,path,body,256*1024),java.nio.charset.StandardCharsets.UTF_8);
        if("/status".equals(path)||"/control".equals(path))try{JSONObject result=new JSONObject(value);if(result.has("owner"))HumanControl.setUser("user".equals(result.optString("owner")));}catch(JSONException ignored){}
        return value;
    }
    static String control(Context c,boolean user)throws Exception {return json(c,"/control",new JSONObject().put("owner",user?"user":"ai"));}
    static String screenshot(Context c)throws IOException {return "data:image/png;base64,"+Base64.encodeToString(request(c,"/screenshot",null,5*1024*1024),Base64.NO_WRAP);}
    static void viewer(Context c)throws Exception {
        JSONObject state=new JSONObject(json(c,"/status",null));if(!state.optBoolean("running"))throw new IOException("独立桌面未就绪："+state.optString("log"));
        String url=new JSONObject(json(c,"/viewer",null)).getString("url");URL u=new URL(url);
        if(!"http".equals(u.getProtocol())||!"127.0.0.1".equals(u.getHost()))throw new IOException("拒绝非本机桌面查看器地址");
        c.startActivity(new Intent(c,SandboxActivity.class).putExtra("url",url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    }
    private static byte[] request(Context context,String path,JSONObject body,int maximum)throws IOException {
        android.content.SharedPreferences p=context.getSharedPreferences("desktop",0);boolean setup=path.startsWith("/setup/");int port=p.getInt(setup?"setup_port":"port",0);String token=p.getString("token","");if(setup)path=path.substring(6);
        if(port<1024||token.isEmpty())throw new IOException("独立桌面尚未启动，请先到 Linux 面板安装并启动");
        HttpURLConnection c=(HttpURLConnection)new URL("http://127.0.0.1:"+port+path).openConnection(Proxy.NO_PROXY);connection=c;
        try{
            c.setConnectTimeout(1500);c.setReadTimeout(20000);c.setInstanceFollowRedirects(false);c.setRequestProperty("Authorization","Bearer "+token);
            if(body!=null){byte[] bytes=body.toString().getBytes("UTF-8");c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");c.setFixedLengthStreamingMode(bytes.length);try(OutputStream out=c.getOutputStream()){out.write(bytes);}}
            int code=c.getResponseCode();ByteArrayOutputStream b=new ByteArrayOutputStream();
            try(InputStream in=code==200?c.getInputStream():c.getErrorStream()){if(in!=null){byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1){if(b.size()+n>maximum)throw new IOException("桌面返回超出容量上限");b.write(buf,0,n);}}}
            if(code!=200)throw new IOException("独立桌面 HTTP "+code+"："+b.toString("UTF-8"));return b.toByteArray();
        }catch(ConnectException e){throw new IOException("独立桌面未连接：请查看 Termux 会话是否启动成功、是否被系统关闭，再检测",e);}
        finally{c.disconnect();if(connection==c)connection=null;}
    }
}
