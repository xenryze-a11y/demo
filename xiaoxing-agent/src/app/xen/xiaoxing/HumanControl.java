package app.xen.xiaoxing;

import java.util.function.BooleanSupplier;

/** One owner at a time; pause time does not consume the active AI task budget. */
final class HumanControl {
    private static final Object lock=new Object();
    private static boolean user;
    private static long since,total;
    static void setUser(boolean value){synchronized(lock){if(value!=user){long now=System.nanoTime()/1000000;if(value)since=now;else total+=now-since;user=value;}lock.notifyAll();}}
    static boolean isUser(){synchronized(lock){return user;}}
    static long pausedMillis(){synchronized(lock){return total+(user?System.nanoTime()/1000000-since:0);}}
    static boolean await(BooleanSupplier running)throws InterruptedException {synchronized(lock){while(user&&running.getAsBoolean())lock.wait(200);return running.getAsBoolean();}}
    static void wake(){synchronized(lock){lock.notifyAll();}}
}
