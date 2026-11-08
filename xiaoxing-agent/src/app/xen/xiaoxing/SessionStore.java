package app.xen.xiaoxing;

import android.content.Context;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;

/** Private app state, outside the model's workspace. Completed protocol groups only. */
final class SessionStore {
    static JSONArray load(Context c,String name){
        AtomicFile file=new AtomicFile(new File(c.getFilesDir(),name+".json"));
        try{byte[] b=file.readFully();if(b.length>3*1024*1024)return new JSONArray();return new JSONArray(new String(b,"UTF-8"));}catch(Exception e){return new JSONArray();}
    }
    static void save(Context c,String name,JSONArray data){
        AtomicFile file=new AtomicFile(new File(c.getFilesDir(),name+".json"));FileOutputStream out=null;
        try{byte[] bytes=data.toString().getBytes("UTF-8");if(bytes.length>3*1024*1024)throw new IOException("会话超过本地保存上限，请导出记录后新建会话");out=file.startWrite();out.write(bytes);file.finishWrite(out);}
        catch(Exception e){if(out!=null)file.failWrite(out);Agent.log("状态","本地会话未保存："+e.getMessage());}
    }
}
