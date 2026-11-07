package app.xen.xiaoxing;
import javax.net.ssl.*;
import java.net.*;
import java.io.*;
import java.security.cert.Certificate;

public class WebToolsTest {
    static int checks;
    interface Action{void run()throws Exception;}
    static void check(boolean b){checks++;if(!b)throw new AssertionError("check "+checks);}
    static void fails(Action a)throws Exception{checks++;try{a.run();throw new AssertionError("Expected failure");}catch(IOException expected){}}
    static class Fake extends HttpsURLConnection {
        String text,type="text/html",redirect;int code=200;boolean closed;
        Fake(String text)throws Exception{super(new URL("https://93.184.216.34/"));this.text=text;}
        public void connect(){}public void disconnect(){closed=true;}public boolean usingProxy(){return false;}
        public int getResponseCode(){return code;}public String getContentType(){return type;}
        public String getHeaderField(String n){return "Location".equals(n)?redirect:null;}
        public InputStream getInputStream()throws IOException{return new ByteArrayInputStream(text.getBytes("UTF-8"));}
        public String getCipherSuite(){return "test";}public Certificate[] getLocalCertificates(){return null;}public Certificate[] getServerCertificates(){return null;}
    }
    public static void main(String[] args)throws Exception {
        for(String ip:new String[]{"127.0.0.1","0.0.0.0","10.0.0.1","172.16.0.1","192.168.1.1","169.254.169.254","100.100.100.200","::1","fc00::1","fe80::1","224.0.0.1"})check(!WebTools.publicAddress(InetAddress.getByName(ip)));
        check(WebTools.publicAddress(InetAddress.getByName("8.8.8.8")));
        for(String url:new String[]{"http://example.com","https://127.0.0.1/","https://user:secret@example.com","https://example.com:8080/","https://localhost/","file:///etc/passwd"})fails(()->WebTools.validate(url));
        Fake good=new Fake("<h1>你好</h1><script>secret()</script><p>A &amp; B &#x661F;</p>");
        WebTools.Page page=WebTools.get("https://93.184.216.34/",()->true,c->{},u->good);check(good.closed);check(WebTools.plain(page.text).equals("你好\n\nA & B 星"));
        Fake redirect=new Fake("");redirect.code=302;redirect.redirect="https://169.254.169.254/latest/meta-data/";fails(()->WebTools.get("https://93.184.216.34/",()->true,c->{},u->redirect));check(redirect.closed);
        Fake error=new Fake("");error.code=429;fails(()->WebTools.get("https://93.184.216.34/",()->true,c->{},u->error));check(error.closed);
        Fake pdf=new Fake("binary");pdf.type="application/pdf";fails(()->WebTools.get("https://93.184.216.34/",()->true,c->{},u->pdf));
        fails(()->WebTools.get("https://93.184.216.34/",()->false,c->{},u->good));
        Fake large=new Fake(new String(new char[WebTools.MAX_BYTES+100]).replace('\0','a'));check(WebTools.get("https://93.184.216.34/",()->true,c->{},u->large).text.contains("截断"));
        check(WebTools.results("<rss><channel><item><title>官方文档</title><link>https://example.com/docs</link><description>真实摘要</description></item></channel></rss>","search").contains("真实摘要"));
        fails(()->WebTools.results("<!DOCTYPE x [<!ENTITY a SYSTEM 'file:///etc/passwd'>]><rss/>","search"));fails(()->WebTools.results("<html>captcha</html>","search"));
        if(args.length>0){String xml=new String(java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(args[0])),"UTF-8");check(WebTools.results(xml,"Bing live RSS").contains("https://"));}
        System.out.println("Web access: "+checks+" checks passed");
    }
}
