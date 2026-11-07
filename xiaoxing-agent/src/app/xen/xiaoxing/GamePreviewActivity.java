package app.xen.xiaoxing;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.io.*;
import java.util.*;

/** Runs only explicitly selected workspace HTML. No JavaScript-to-Java bridge. */
public class GamePreviewActivity extends Activity {
    private static final List<String> logs=Collections.synchronizedList(new ArrayList<>());
    static volatile String current="未打开预览";
    WebView web;
    static void note(String message){synchronized(logs){logs.add(message);while(logs.size()>40)logs.remove(0);}}
    static String report(){synchronized(logs){StringBuilder b=new StringBuilder(current);for(String line:logs)b.append('\n').append(line);return b.toString();}}
    @Override public void onCreate(Bundle saved){super.onCreate(saved);
        LinearLayout root=new LinearLayout(this);root.setOrientation(1);root.setBackgroundColor(0xff090b10);setContentView(root);
        if(android.os.Build.VERSION.SDK_INT>=30)root.setOnApplyWindowInsetsListener((v,insets)->{android.graphics.Insets i=insets.getInsets(WindowInsets.Type.systemBars());v.setPadding(i.left,i.top,i.right,i.bottom);return insets;});
        LinearLayout top=new LinearLayout(this);Button back=new Button(this);back.setText("返回小星");back.setOnClickListener(v->finish());top.addView(back);Button reload=new Button(this);reload.setText("刷新预览");reload.setOnClickListener(v->web.reload());top.addView(reload);root.addView(top);
        web=new WebView(this);web.setBackgroundColor(0xff090b10);root.addView(web,new LinearLayout.LayoutParams(-1,0,1));
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setDomStorageEnabled(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebChromeClient(new WebChromeClient(){@Override public boolean onConsoleMessage(ConsoleMessage m){String s=m.message();note(m.messageLevel()+" "+m.lineNumber()+": "+s.substring(0,Math.min(s.length(),1000)));return true;}});
        web.setWebViewClient(new WebViewClient(){@Override public void onPageFinished(WebView view,String url){note("页面加载完成");}@Override public void onReceivedError(WebView view,WebResourceRequest r,WebResourceError e){note("加载错误："+e.getDescription());}@Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){String scheme=request.getUrl().getScheme();return !"https".equals(scheme)&&!"http".equals(scheme);}});
        try{
            String html;String path=getIntent().getStringExtra("path");
            if(path==null){current="本地游戏测试场";try(InputStream in=getAssets().open("game-lab.html")){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)out.write(b,0,n);html=out.toString("UTF-8");}}
            else{current="工作区预览："+path;html=new FilesBox(new File(getFilesDir(),"workspace")).read(path);}
            logs.clear();note("预览启动："+current);web.loadDataWithBaseURL("https://xiaoxing.local/",html,"text/html","UTF-8",null);
        }catch(Exception e){note("预览失败："+e.getMessage());web.loadData("<body style='background:#111;color:#eee'>无法打开预览，请返回查看工具日志</body>","text/html","UTF-8");}
    }
    @Override public void onDestroy(){if(web!=null){web.stopLoading();web.destroy();}super.onDestroy();}
}
