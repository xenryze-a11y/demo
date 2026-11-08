package app.xen.xiaoxing;

import android.content.*;
import android.os.Bundle;

/** Receives only the one-shot result of this app's current Termux setup request. */
public class SandboxSetupReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){
        android.content.SharedPreferences prefs=context.getSharedPreferences("desktop",0);String nonce=prefs.getString("setup_request","");
        if(nonce.isEmpty()||!(context.getPackageName()+".SETUP."+nonce).equals(intent.getAction()))return;
        Bundle result=intent.getBundleExtra("result");if(result==null)return;
        int err=result.getInt("err",-1),exit=result.getInt("exitCode",-1);
        if(err==-1&&exit==0)return;
        String message="Termux 安装会话未完成 · "+(err!=-1?"错误 "+err+"："+result.getString("errmsg",""):"退出码 "+exit+"\n"+result.getString("stdout","")+"\n"+result.getString("stderr",""));
        message+="\n若提示 allow-external-apps 或权限，请先点「首次连接 Termux」完成一次宿主设置，再授权重试。";
        if(message.length()>8000)message=message.substring(0,8000);prefs.edit().putString("setup_error",message).apply();
    }
}
