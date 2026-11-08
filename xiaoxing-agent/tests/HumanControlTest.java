package app.xen.xiaoxing;
import java.util.concurrent.atomic.*;

public class HumanControlTest {
    public static void main(String[] args)throws Exception {
        HumanControl.setUser(true);AtomicBoolean running=new AtomicBoolean(true),resumed=new AtomicBoolean(false);
        long baseline=HumanControl.pausedMillis();Thread worker=new Thread(()->{try{resumed.set(HumanControl.await(running::get));}catch(InterruptedException e){throw new RuntimeException(e);}});worker.start();
        Thread.sleep(120);if(resumed.get()||HumanControl.pausedMillis()-baseline<100)throw new AssertionError("AI not paused");
        HumanControl.setUser(false);worker.join(1500);if(!resumed.get()||worker.isAlive())throw new AssertionError("AI did not resume");
        long paused=HumanControl.pausedMillis();Thread.sleep(50);if(HumanControl.pausedMillis()!=paused)throw new AssertionError("Pause budget still accumulating");
        HumanControl.setUser(true);AtomicBoolean result=new AtomicBoolean(true);Thread stopped=new Thread(()->{try{result.set(HumanControl.await(running::get));}catch(InterruptedException e){throw new RuntimeException(e);}});stopped.start();Thread.sleep(40);running.set(false);HumanControl.wake();stopped.join(1500);
        if(result.get()||stopped.isAlive())throw new AssertionError("Stop must interrupt a manual-control pause");HumanControl.setUser(false);
        System.out.println("Human control: task pause, resume, pause-time budget and stop passed");
    }
}
