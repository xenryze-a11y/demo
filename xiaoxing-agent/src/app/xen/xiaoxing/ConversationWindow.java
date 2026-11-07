package app.xen.xiaoxing;

import org.json.*;
import java.util.*;

/** Retain the current user request and recent complete assistant/tool groups. */
final class ConversationWindow {
    static JSONArray compact(JSONArray history)throws JSONException {
        List<Integer> starts=new ArrayList<>();List<Integer> weights=new ArrayList<>();int total=0,lastUser=-1;
        for(int i=0;i<history.length();){
            int start=i;JSONObject message=history.getJSONObject(i++);int weight=weight(message);
            if("user".equals(message.optString("role"))&&!text(message).startsWith("这是刚才截图工具返回的图片"))lastUser=start;
            JSONArray calls=message.optJSONArray("tool_calls");if(calls!=null)for(int j=0;j<calls.length()&&i<history.length();j++)weight+=weight(history.getJSONObject(i++));
            starts.add(start);weights.add(weight);total+=weight;
        }
        if(history.length()<=60&&total<=120000)return history;
        int from=history.length(),used=0;
        for(int k=starts.size()-1;k>=0;k--){int next=starts.get(k),cost=weights.get(k);if(from<history.length()&&(history.length()-next>50||used+cost>100000))break;from=next;used+=cost;}
        JSONArray kept=new JSONArray();if(lastUser>=0&&lastUser<from)kept.put(history.get(lastUser));
        for(int i=from;i<history.length();i++)kept.put(history.get(i));return kept;
    }
    private static int weight(JSONObject message)throws JSONException {
        Object content=message.opt("content");int size=text(message).length();JSONArray calls=message.optJSONArray("tool_calls");if(calls!=null)size+=calls.toString().length();
        // Image bytes are handled separately by the provider; never remove a fresh screenshot just for base64 size.
        return size+message.optString("reasoning_content","").length()+100;
    }
    private static String text(JSONObject message)throws JSONException {
        Object content=message.opt("content");if(!(content instanceof JSONArray))return message.optString("content","");
        StringBuilder out=new StringBuilder();JSONArray parts=(JSONArray)content;for(int i=0;i<parts.length();i++){JSONObject part=parts.getJSONObject(i);if("text".equals(part.optString("type")))out.append(part.optString("text"));}return out.toString();
    }
}
