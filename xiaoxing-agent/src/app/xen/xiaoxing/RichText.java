package app.xen.xiaoxing;
import android.graphics.Typeface;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.*;
import java.util.regex.*;

final class RichText {
    static CharSequence render(String source){
        SpannableStringBuilder out=new SpannableStringBuilder();boolean code=false;
        for(String line:source.split("\n",-1)){
            if(line.trim().startsWith("```")){code=!code;if(out.length()>0)out.append('\n');continue;}
            boolean heading=!code&&line.matches("^#{1,4} .*"),quote=!code&&line.startsWith("> ");
            if(heading)line=line.replaceFirst("^#{1,4} +","");if(quote)line="│ "+line.substring(2);
            int start=out.length();
            if(code){out.append(line);out.setSpan(new TypefaceSpan("monospace"),start,out.length(),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);out.setSpan(new BackgroundColorSpan(0xff10141c),start,out.length(),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);out.setSpan(new ForegroundColorSpan(0xffd6b66b),start,out.length(),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);}
            else{
                Pattern pattern=Pattern.compile("\\*\\*(.+?)\\*\\*|`([^`]+)`");Matcher m=pattern.matcher(line);int at=0;
                while(m.find()){out.append(line.substring(at,m.start()));int s=out.length();out.append(m.group(1)!=null?m.group(1):m.group(2));out.setSpan(m.group(1)!=null?new StyleSpan(Typeface.BOLD):new TypefaceSpan("monospace"),s,out.length(),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);at=m.end();}out.append(line.substring(at));
            }
            if(heading){out.setSpan(new StyleSpan(Typeface.BOLD),start,out.length(),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);out.setSpan(new ForegroundColorSpan(0xffd6b66b),start,out.length(),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);out.setSpan(new RelativeSizeSpan(1.15f),start,out.length(),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);}
            out.append('\n');
        }return out;
    }
}
