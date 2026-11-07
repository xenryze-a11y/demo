package app.xen.xiaoxing;
import android.app.*;
import android.content.*;
import android.os.IBinder;

public class TaskService extends Service {
    public IBinder onBind(Intent i){return null;}
    public int onStartCommand(Intent i,int flags,int startId){
        if(i!=null&&"stop".equals(i.getAction())){Agent.stop();stopSelf();return START_NOT_STICKY;}
        NotificationManager nm=getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel("task","AI 任务状态",NotificationManager.IMPORTANCE_LOW));
        PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,TaskService.class).setAction("stop"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n=new Notification.Builder(this,"task").setSmallIcon(app.xen.xiaoxing.R.drawable.ic_star).setContentTitle("小星正在执行任务").setContentText("模型 / 手机 / Linux · 点停止终止任务").setContentIntent(open).setOngoing(true).addAction(new Notification.Action.Builder(null,"停止任务",stop).build()).build();
        startForeground(1,n);return START_NOT_STICKY;
    }
    public void onDestroy(){super.onDestroy();}
}
