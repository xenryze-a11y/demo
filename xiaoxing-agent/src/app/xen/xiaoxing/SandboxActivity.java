package app.xen.xiaoxing;

import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.Icon;
import android.os.*;
import android.util.Rational;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.net.URL;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

/** Live desktop, explicit control handoff and Android picture-in-picture. */
public class SandboxActivity extends Activity {
    private WebView view;private String origin,address;private LinearLayout toolbar;
    private TextView state,shield;private Button control;private boolean user,changing,polling,closed;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Runnable refresh=new Runnable(){public void run(){
        if(!closed&&!polling&&!changing){polling=true;worker.execute(()->{try{JSONObject s=new JSONObject(DesktopBridge.json(SandboxActivity.this,"/status",null));runOnUiThread(()->render("user".equals(s.optString("owner")),s.optBoolean("running")?null:"桌面进程已停止"));}catch(Exception e){runOnUiThread(()->state.setText("桌面未连接 · "+e.getMessage()));}finally{polling=false;}});}
        if(!closed)handler.postDelayed(this,2000);
    }};
    private boolean allowed(String url){try{URL u=new URL(url);return "http".equals(u.getProtocol())&&"127.0.0.1".equals(u.getHost())&&origin.equals(u.getProtocol()+"://"+u.getAuthority());}catch(Exception e){return false;}}
    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);address=getIntent().getStringExtra("url");
        try{URL u=new URL(address);origin=u.getProtocol()+"://"+u.getAuthority();}catch(Exception e){finish();return;}
        if(!allowed(address)){finish();return;}
        LinearLayout root=new LinearLayout(this);root.setOrientation(1);root.setBackgroundColor(Color.BLACK);
        state=new TextView(this);state.setTextColor(0xffd6b66b);state.setText("连接独立电脑…");state.setPadding(16,12,16,8);root.addView(state);
        toolbar=new LinearLayout(this);control=button("我来操作",()->take(!user));toolbar.addView(control,new LinearLayout.LayoutParams(0,-2,1));
        toolbar.addView(button("小窗观看",this::pictureInPicture),new LinearLayout.LayoutParams(0,-2,1));
        toolbar.addView(button("回到对话",()->{pictureInPicture();startActivity(new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT));}),new LinearLayout.LayoutParams(0,-2,1));root.addView(toolbar);
        FrameLayout screen=new FrameLayout(this);root.addView(screen,new LinearLayout.LayoutParams(-1,0,1));
        view=new WebView(this);WebSettings s=view.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(false);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setJavaScriptCanOpenWindowsAutomatically(false);s.setSupportMultipleWindows(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        view.setWebViewClient(new WebViewClient(){
            public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest request){return !allowed(request.getUrl().toString());}
            public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest request){return allowed(request.getUrl().toString())?null:new WebResourceResponse("text/plain","UTF-8",new java.io.ByteArrayInputStream(new byte[0]));}
        });screen.addView(view,new FrameLayout.LayoutParams(-1,-1));
        shield=new TextView(this);shield.setGravity(Gravity.CENTER);shield.setTextColor(0xffe6c987);shield.setText("");shield.setTextSize(15);shield.setBackgroundColor(Color.TRANSPARENT);shield.setClickable(true);shield.setOnClickListener(v->Toast.makeText(this,"点「我来操作」暂停 AI 后，就能在画面内操作",Toast.LENGTH_SHORT).show());screen.addView(shield,new FrameLayout.LayoutParams(-1,-1));
        setContentView(root);view.loadUrl(address);handler.post(refresh);updatePip();
        if("takeover".equals(getIntent().getAction()))take(true);
    }
    private Button button(String name,Runnable action){Button b=new Button(this);b.setText(name);b.setAllCaps(false);b.setTextSize(12);b.setOnClickListener(v->action.run());return b;}
    private void take(boolean target){
        if(changing)return;changing=true;control.setEnabled(false);state.setText(target?"正在接管，等待 AI 当前动作结束…":"正在交还 AI…");
        worker.execute(()->{try{DesktopBridge.control(this,target);runOnUiThread(()->render(target,null));}catch(Exception e){runOnUiThread(()->state.setText("控制权切换未完成："+e.getMessage()));}finally{runOnUiThread(()->{changing=false;control.setEnabled(true);});}});
    }
    private void render(boolean owner,String error){
        if(closed)return;user=owner;control.setText(user?"交还 AI 继续":"我来操作");shield.setVisibility(user||isInPictureInPictureMode()?View.GONE:View.VISIBLE);
        state.setText(error!=null?error:user?"你正在操作 · AI 已暂停截图、动作和命令":"AI 操作中 · 你可实时观看，随时接管");updatePip();
    }
    private void updatePip(){
        if(!getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE))return;
        Intent intent=new Intent(this,SandboxActivity.class).setAction("takeover").putExtra("url",address).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending=PendingIntent.getActivity(this,51,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        RemoteAction action=new RemoteAction(Icon.createWithResource(this,R.drawable.ic_star),"展开接管","展开画面并暂停 AI，交由你操作",pending);
        setPictureInPictureParams(new PictureInPictureParams.Builder().setAspectRatio(new Rational(16,10)).setActions(Collections.singletonList(action)).build());
    }
    private void pictureInPicture(){
        if(!getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)){Toast.makeText(this,"此设备未提供画中画，可使用应用内实时桌面",Toast.LENGTH_LONG).show();return;}
        try{updatePip();if(!isInPictureInPictureMode())enterPictureInPictureMode(new PictureInPictureParams.Builder().setAspectRatio(new Rational(16,10)).build());}
        catch(Exception e){Toast.makeText(this,"未能开启小窗：请检查系统对小星的画中画权限",Toast.LENGTH_LONG).show();}
    }
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);if("takeover".equals(intent.getAction()))take(true);}
    @Override public void onPictureInPictureModeChanged(boolean pip,Configuration config){super.onPictureInPictureModeChanged(pip,config);toolbar.setVisibility(pip?View.GONE:View.VISIBLE);state.setVisibility(pip?View.GONE:View.VISIBLE);shield.setVisibility(pip||user?View.GONE:View.VISIBLE);}
    @Override protected void onDestroy(){closed=true;handler.removeCallbacks(refresh);worker.shutdownNow();if(view!=null){view.stopLoading();view.clearHistory();view.clearCache(true);view.destroy();}super.onDestroy();}
}
