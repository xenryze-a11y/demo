package app.xen.xiaoxing;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.*;
import java.net.URL;

/** Local noVNC viewer. No file/content access or JavaScript-to-Java bridge. */
public class SandboxActivity extends Activity {
    private WebView view;
    private String origin;
    private boolean allowed(String address){try{URL u=new URL(address);return "http".equals(u.getProtocol())&&"127.0.0.1".equals(u.getHost())&&origin.equals(u.getProtocol()+"://"+u.getAuthority());}catch(Exception e){return false;}}
    @Override public void onCreate(Bundle state){
        super.onCreate(state);String address=getIntent().getStringExtra("url");
        try{URL u=new URL(address);origin=u.getProtocol()+"://"+u.getAuthority();}catch(Exception e){finish();return;}
        if(!allowed(address)){finish();return;}
        view=new WebView(this);WebSettings s=view.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(false);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setJavaScriptCanOpenWindowsAutomatically(false);s.setSupportMultipleWindows(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        view.setWebViewClient(new WebViewClient(){
            public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest request){return !allowed(request.getUrl().toString());}
            public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest request){return allowed(request.getUrl().toString())?null:new WebResourceResponse("text/plain","UTF-8",new java.io.ByteArrayInputStream(new byte[0]));}
        });setContentView(view);view.loadUrl(address);
    }
    @Override protected void onDestroy(){if(view!=null){view.stopLoading();view.clearHistory();view.clearCache(true);view.destroy();}super.onDestroy();}
}
