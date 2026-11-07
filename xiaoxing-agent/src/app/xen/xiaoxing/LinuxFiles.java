package app.xen.xiaoxing;

import android.content.Context;
import java.io.*;
import java.util.UUID;

final class LinuxFiles {
    static String transfer(Context context,FilesBox box,String path,String target,boolean push)throws Exception {
        return transfer(context,box,path,target,push,false);
    }
    static String transfer(Context context,FilesBox box,String path,String target,boolean push,boolean nativeTermux)throws Exception {
        String relative=push?target:path;
        if(relative==null||relative.isEmpty()||relative.startsWith("/")||relative.indexOf('\0')>=0)throw new IOException("Linux 路径必须相对于 /root/xiaoxing-workspace");
        File local=box.resolve(push?path:target);
        try(LoopbackTransfer bridge=new LoopbackTransfer(local,!push,()->Agent.running)){
            String script="import pathlib,subprocess,os,hashlib\n"+
                (nativeTermux?"root=(pathlib.Path.home()/'xiaoxing-workspace').resolve()\n":"root=pathlib.Path('/root/xiaoxing-workspace').resolve()\n")+
                "p=(root/"+py(relative)+").resolve()\n"+
                "assert p!=root and root in p.parents, 'path outside Linux workspace'\n"+
                (push?
                "assert not p.exists(), 'target exists; use a new path'\np.parent.mkdir(parents=True,exist_ok=True)\n"+
                "tmp=p.with_name('.transfer-'+"+py(UUID.randomUUID().toString())+")\n"+
                "try:\n subprocess.run(['curl','--fail','--silent','--show-error','--noproxy','127.0.0.1','--max-time','90','-o',str(tmp),"+py(bridge.url())+"],check=True)\n os.link(tmp,p)\nfinally:\n tmp.unlink(missing_ok=True)\n":
                "assert p.is_file() and p.stat().st_size<=67108864, 'file missing or too large'\n"+
                "subprocess.run(['curl','--fail','--silent','--show-error','--noproxy','127.0.0.1','--max-time','90','-H','Expect:','-T',str(p),"+py(bridge.url())+"],check=True)\n")+
                "print('Linux file:',str(p),'bytes:',p.stat().st_size)\n";
            if(nativeTermux)LinuxBridge.executeNative(context,"python -c "+LinuxCommands.quote(script),100);else LinuxBridge.execute(context,"python3 -c "+LinuxCommands.quote(script),100);
            long bytes=bridge.await();return "传输完成 · "+bytes+" 字节\n"+(push?"App "+path+" → "+(nativeTermux?"Termux ":"Linux ")+target:(nativeTermux?"Termux ":"Linux ")+path+" → App "+target);
        }
    }
    private static String py(String s){return "'"+s.replace("\\","\\\\").replace("'","\\'").replace("\n","\\n").replace("\r","\\r")+"'";}
}
