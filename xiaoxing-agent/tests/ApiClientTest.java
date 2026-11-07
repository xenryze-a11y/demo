package app.xen.xiaoxing;
import org.json.*;
import javax.net.ssl.*;
import java.io.*;
import java.net.*;
import java.security.Principal;
import java.security.cert.Certificate;

public class ApiClientTest {
    static int count=0;
    static final String KEY="sk-personal-test-NeverPrintThisValue";
    static final String URL="https://api.longcat.chat/openai/v1/chat/completions";
    static void check(boolean b){count++;if(!b)throw new AssertionError("check "+count);}
    interface Action{void run()throws Exception;}
    static String fails(Action action)throws Exception{try{action.run();throw new AssertionError("Expected failure");}catch(ApiDiagnostics.Failure e){check(!e.getMessage().contains(KEY));return e.getMessage();}}
    static class Fake extends HttpsURLConnection {
        int status;String response;boolean closed=false;IOException error;ByteArrayOutputStream request=new ByteArrayOutputStream();
        Fake(int status,String response)throws Exception{super(new URL(URL));this.status=status;this.response=response;}
        public void connect(){}public void disconnect(){closed=true;}public boolean usingProxy(){return false;}
        public OutputStream getOutputStream()throws IOException{if(error!=null)throw error;return request;}
        public int getResponseCode(){return status;}
        public InputStream getErrorStream(){return new ByteArrayInputStream(response.getBytes(java.nio.charset.StandardCharsets.UTF_8));}
        public InputStream getInputStream(){return getErrorStream();}
        public String getCipherSuite(){return "test";}public Certificate[] getLocalCertificates(){return null;}public Certificate[] getServerCertificates(){return null;}
        public Principal getPeerPrincipal(){return null;}public Principal getLocalPrincipal(){return null;}
        public String getHeaderField(String key){return "x-request-id".equals(key)?"req-offline-test":null;}
    }
    static JSONObject body()throws Exception{return new JSONObject().put("model","LongCat-2.5").put("messages",new JSONArray());}
    static JSONObject request(Fake f)throws Exception{return ApiClient.post(URL,KEY,body(),()->true,c->{},u->f);}
    public static void main(String[] args)throws Exception {
        Fake auth=new Fake(401,"{\"error\":{\"code\":\"invalid_api_key\",\"message\":\"Invalid key: "+KEY+"\"}}");
        String a=fails(()->request(auth));check(a.contains("HTTP 状态：401"));check(a.contains("invalid_api_key"));check(a.contains("服务商验证/处理请求"));check(a.contains("req-offline-test"));check(a.contains("LongCat-2.5"));check(auth.closed);check(auth.request.size()>0);
        Fake limited=new Fake(429,"{\"error\":{\"message\":\"Rate limit reached\",\"type\":\"rate_limit\"}}");String b=fails(()->request(limited));check(b.contains("Rate limit reached"));check(b.contains("可能是请求频率"));
        Fake html=new Fake(502,"<html>Gateway unavailable</html>");check(fails(()->request(html)).contains("非标准错误正文"));
        Fake good=new Fake(200,"{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"OK\"}}]}");check(request(good).getJSONArray("choices").length()==1);check(good.closed);
        Fake invalid=new Fake(200,"<html>Login page</html>");check(fails(()->request(invalid)).contains("响应不是 JSON"));
        Fake timeout=new Fake(200,"");timeout.error=new SocketTimeoutException("timed out");check(fails(()->request(timeout)).contains("连接或读取超时"));check(timeout.closed);
        check(fails(()->ApiDiagnostics.validate(URL,"Bearer "+KEY,"model")).contains("多填了 Bearer"));
        check(fails(()->ApiDiagnostics.validate(URL,"abc def","model")).contains("空白"));
        check(fails(()->ApiDiagnostics.validate("https://api.longcat.chat/openai/v1",KEY,"model")).contains("/chat/completions"));
        check(fails(()->ApiDiagnostics.validate(URL,KEY,"")).contains("模型名称为空"));
        String redacted=ApiDiagnostics.redact("Bearer "+KEY+" other sk-secret-fragment",KEY);check(!redacted.contains(KEY));check(!redacted.contains("sk-secret-fragment"));
        check(!ApiDiagnostics.endpoint(URL+"?key="+KEY,KEY).contains(KEY));
        Fake stopped=new Fake(200,"");check(fails(()->ApiClient.post(URL,KEY,body(),()->false,c->{},u->stopped)).contains("任务已停止"));check(stopped.closed);
        System.out.println("ApiClient diagnostics: "+count+" checks passed (offline, no credentials/network)");
    }
}
