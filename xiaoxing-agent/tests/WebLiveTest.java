package app.xen.xiaoxing;
import java.net.*;
import java.io.*;
import java.security.*;
import java.security.cert.*;
import javax.net.ssl.*;

/** Real anonymous HTTPS; honors the development environment's proxy and CA trust. */
public class WebLiveTest {
    public static void main(String[] args)throws Exception {
        String proxy=System.getenv("HTTPS_PROXY");if(proxy!=null&&!proxy.isEmpty()){URI u=new URI(proxy);System.setProperty("https.proxyHost",u.getHost());System.setProperty("https.proxyPort",String.valueOf(u.getPort()>0?u.getPort():80));}
        String ca=System.getenv("SSL_CERT_FILE");if(ca==null)ca="/etc/ssl/certs/ca-certificates.crt";
        KeyStore store=KeyStore.getInstance(KeyStore.getDefaultType());store.load(null);int count=0;
        try(InputStream in=new FileInputStream(ca)){for(java.security.cert.Certificate cert:CertificateFactory.getInstance("X.509").generateCertificates(in))store.setCertificateEntry("runtime-ca-"+(count++),cert);}
        TrustManagerFactory tm=TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());tm.init(store);SSLContext context=SSLContext.getInstance("TLS");context.init(null,tm.getTrustManagers(),null);HttpsURLConnection.setDefaultSSLSocketFactory(context.getSocketFactory());
        String results=WebTools.search("DeepSeek API 官方文档",()->true,c->{});if(!results.contains("https://"))throw new AssertionError("No search sources");
        String page=WebTools.read("https://api-docs.deepseek.com/",()->true,c->{});if(!page.contains("HTTP：200")||!page.toLowerCase(java.util.Locale.ROOT).contains("deepseek"))throw new AssertionError("No real page content");
        System.out.println("Live web: search returned source URLs; official DeepSeek HTTPS page returned HTTP 200 and readable content (no API key).");
    }
}
