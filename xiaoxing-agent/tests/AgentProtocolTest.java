package app.xen.xiaoxing;
import android.content.Context;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import javax.net.ssl.*;
import java.security.cert.Certificate;

/** Runs the real Agent/ApiClient/filesystem, with Android lifecycle and HTTPS doubles. */
public class AgentProtocolTest {
    static int checks;
    static Queue<Fake> replies=new ArrayDeque<>();
    static List<JSONObject> requests=new ArrayList<>();
    static void check(boolean b){checks++;if(!b)throw new AssertionError("check "+checks);}
    static class Fake extends HttpsURLConnection {
        final int status;final String data;final ByteArrayOutputStream sent=new ByteArrayOutputStream();
        Fake(int status,String data)throws Exception{super(new URL("https://api.deepseek.com/chat/completions"));this.status=status;this.data=data;}
        public void connect(){}public void disconnect(){if(sent.size()>0)try{requests.add(new JSONObject(sent.toString("UTF-8")));}catch(Exception e){throw new RuntimeException(e);}}public boolean usingProxy(){return false;}
        public OutputStream getOutputStream(){return sent;}public int getResponseCode(){return status;}
        public InputStream getInputStream(){return new ByteArrayInputStream(data.getBytes(java.nio.charset.StandardCharsets.UTF_8));}public InputStream getErrorStream(){return getInputStream();}
        public String getCipherSuite(){return "test";}public Certificate[] getLocalCertificates(){return null;}public Certificate[] getServerCertificates(){return null;}
    }
    static JSONObject call(String id,String name,JSONObject args)throws Exception{return new JSONObject().put("id",id).put("type","function").put("function",new JSONObject().put("name",name).put("arguments",args.toString()));}
    static Fake answer(String text,JSONObject...calls)throws Exception {
        JSONObject message=new JSONObject().put("role","assistant").put("content",text);
        if(calls.length>0)message.put("tool_calls",new JSONArray(calls)).put("reasoning_content","provider reasoning");
        return new Fake(200,new JSONObject().put("model","deepseek-flash").put("choices",new JSONArray().put(new JSONObject().put("message",message))).toString());
    }
    static void prepare(Context context){Agent.app=context;Agent.history=new JSONArray();Agent.running=true;Agent.begin();replies.clear();requests.clear();}
    static void protocol(JSONArray history)throws Exception {
        for(int i=0;i<history.length();i++){
            JSONObject message=history.getJSONObject(i);JSONArray calls=message.optJSONArray("tool_calls");
            if(calls==null)continue;
            Set<String> ids=new HashSet<>();for(int j=0;j<calls.length();j++)ids.add(calls.getJSONObject(j).getString("id"));
            for(int j=0;j<calls.length();j++){JSONObject result=history.getJSONObject(++i);check("tool".equals(result.getString("role")));check(ids.remove(result.getString("tool_call_id")));}check(ids.isEmpty());
        }
    }
    public static void main(String[] args)throws Exception {
        URL.setURLStreamHandlerFactory(scheme->"https".equals(scheme)?new URLStreamHandler(){protected URLConnection openConnection(URL u)throws IOException{Fake next=replies.poll();if(next==null)throw new IOException("Unplanned API call");return next;}}:null);
        Context context=new Context(Files.createTempDirectory("xiaoxing-agent-protocol").toFile());FilesBox box=new FilesBox(new File(context.getFilesDir(),"workspace"));box.write("input.txt","用户的真实附件内容",false);
        prepare(context);
        replies.add(answer("",call("read","read_file",new JSONObject().put("path","input.txt"))));replies.add(answer("已读到实际内容"));
        Agent.run("请读取 input.txt",null,false,false,false,true,false);
        check(Agent.history.toString().contains("用户的真实附件内容"));check(requests.get(0).getJSONArray("tools").toString().contains("web_search"));protocol(Agent.history);
        check(SessionStore.saved.toString().equals(Agent.history.toString()));

        prepare(context);
        replies.add(answer("",call("write","write_file",new JSONObject().put("path","resume.txt").put("content","已落盘的代码"))));
        replies.add(new Fake(429,"{\"error\":{\"message\":\"quota exhausted\"}}"));
        try{Agent.run("写好代码后继续",null,false,false,false,false,false);throw new AssertionError();}catch(ApiDiagnostics.Failure expected){check(expected.getMessage().contains("429"));}
        check(box.read("resume.txt").equals("已落盘的代码"));check(Agent.history.toString().contains("已写入 resume.txt"));protocol(Agent.history);
        Agent.history=new JSONArray(SessionStore.saved.toString());Agent.running=true;Agent.begin();replies.add(answer("继续利用已有文件，不重复创建"));
        Agent.run("继续",null,false,false,false,false,false);
        check(requests.get(requests.size()-1).getJSONArray("messages").toString().contains("已写入 resume.txt"));protocol(Agent.history);

        prepare(context);Agent.linuxAllowed=true;
        replies.add(answer("",call("a","write_file",new JSONObject().put("path","before-stop.txt").put("content","kept")),call("b","linux_exec",new JSONObject().put("command","stop-test")),call("c","write_file",new JSONObject().put("path","after-stop.txt").put("content","must-not-run"))));
        Agent.run("执行后停止",null,false,false,true,false,false);
        check(box.read("before-stop.txt").equals("kept"));check(!box.resolve("after-stop.txt").exists());check(Agent.history.toString().contains("此工具未执行"));protocol(Agent.history);

        prepare(context);
        replies.add(answer("图片任务完成"));Agent.run("看图","data:image/png;base64,test",false,false,false,false,false);
        check(!SessionStore.saved.toString().contains("base64"));check(SessionStore.saved.toString().contains("历史图片未保留"));
        JSONArray longHistory=new JSONArray().put(Agent.message("user","保留这条任务指令"));
        for(int i=0;i<50;i++){JSONArray calls=new JSONArray().put(call("t"+i,"read_file",new JSONObject().put("path","input.txt")));longHistory.put(Agent.message("assistant","").put("tool_calls",calls));longHistory.put(Agent.message("tool","result "+i).put("tool_call_id","t"+i));}
        JSONArray compact=ConversationWindow.compact(longHistory);check(compact.length()<longHistory.length());check(compact.getJSONObject(0).getString("content").equals("保留这条任务指令"));check(compact.toString().contains("result 49"));protocol(compact);
        System.out.println("Real agent protocol: "+checks+" checks passed (attachments, web schemas, quota recovery, persisted complete tool groups, stop, image removal; simulated provider/Android)");
    }
}
