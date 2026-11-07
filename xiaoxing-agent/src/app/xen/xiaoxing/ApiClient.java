package app.xen.xiaoxing;

import org.json.*;
import javax.net.ssl.HttpsURLConnection;
import java.net.URL;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.function.*;

final class ApiClient {
    interface Opener {HttpsURLConnection open(URL u)throws Exception;}
    static JSONObject post(String endpoint,String key,JSONObject body,BooleanSupplier active,Consumer<HttpsURLConnection> register)throws Exception {
        return post(endpoint,key,body,active,register,u->(HttpsURLConnection)u.openConnection());
    }
    static JSONObject post(String endpoint,String key,JSONObject body,BooleanSupplier active,Consumer<HttpsURLConnection> register,Opener opener)throws Exception {
        String model=body.optString("model","");ApiDiagnostics.validate(endpoint,key,model);
        String stage="建立 HTTPS 连接";HttpsURLConnection c=null;
        try{
            c=opener.open(new URL(endpoint));register.accept(c);c.setInstanceFollowRedirects(false);c.setRequestMethod("POST");c.setConnectTimeout(20000);c.setReadTimeout(90000);c.setDoOutput(true);
            c.setRequestProperty("Content-Type","application/json");c.setRequestProperty("Authorization","Bearer "+key);
            stage="发送 API 请求";if(!active.getAsBoolean())throw new IOException("任务已停止");
            try(OutputStream out=c.getOutputStream()){out.write(body.toString().getBytes(StandardCharsets.UTF_8));}
            stage="读取服务商响应";int status=c.getResponseCode();
            if(status!=200){
                String raw=read(c.getErrorStream(),16384,active);String code="",detail="",requestId=c.getHeaderField("x-request-id");
                try{JSONObject errorBody=new JSONObject(raw);JSONObject e=errorBody.optJSONObject("error");if(e==null)e=errorBody;detail=e.optString("message",e.optString("msg",""));code=e.optString("code",e.optString("type",""));if(requestId==null)requestId=errorBody.optString("request_id","");}catch(JSONException ignored){}
                if(detail.isEmpty())detail=raw.isEmpty()?"服务商没有返回可读的错误正文。":"服务器返回了非标准错误正文："+raw;
                if(requestId!=null&&!requestId.isEmpty())detail+="\n请求编号："+requestId;
                throw new ApiDiagnostics.Failure(ApiDiagnostics.report("服务商验证/处理请求",endpoint,model,status,code,detail,ApiDiagnostics.advice(status),key));
            }
            stage="解析 API 响应";String raw=read(c.getInputStream(),4*1024*1024,active);
            try{return new JSONObject(raw);}catch(JSONException e){throw new ApiDiagnostics.Failure(ApiDiagnostics.report(stage,endpoint,model,status,"","HTTP 成功，但响应不是 JSON。可能填了网页、代理登录页或不兼容的接口。","检查完整接口路径与平台协议；不要填平台网页地址。",key));}
        }catch(Exception e){throw ApiDiagnostics.transport(stage,endpoint,model,e,key);}finally{if(c!=null)c.disconnect();register.accept(null);}
    }
    private static String read(InputStream in,int limit,BooleanSupplier active)throws IOException {
        if(in==null)return "";
        try(InputStream stream=in){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=stream.read(b))!=-1){if(!active.getAsBoolean())throw new IOException("任务已停止");int take=Math.min(n,limit-out.size());out.write(b,0,take);if(out.size()>=limit)break;}return out.toString("UTF-8");}
    }
}
