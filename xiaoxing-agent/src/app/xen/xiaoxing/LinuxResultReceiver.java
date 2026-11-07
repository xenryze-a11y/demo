package app.xen.xiaoxing;
import android.content.*;
public class LinuxResultReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c,Intent i){LinuxBridge.receive(i);}
}
