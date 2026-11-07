package app.xen.xiaoxing;
import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;

public class LoopbackTransferTest {
    static int checks;
    static void check(boolean b){checks++;if(!b)throw new AssertionError("check "+checks);}
    public static void main(String[] args)throws Exception {
        Path root=Files.createTempDirectory("xiaoxing-transfer");byte[] data=new byte[512*1024+13];new Random(19).nextBytes(data);Path source=root.resolve("source.apk");Files.write(source,data);
        try(LoopbackTransfer transfer=new LoopbackTransfer(source.toFile(),false,()->true)){
            check(transfer.server.getInetAddress().isLoopbackAddress());HttpURLConnection c=(HttpURLConnection)new URL(transfer.url()).openConnection(Proxy.NO_PROXY);ByteArrayOutputStream b=new ByteArrayOutputStream();
            try(InputStream in=c.getInputStream()){byte[] buf=new byte[16384];int n;while((n=in.read(buf))!=-1)b.write(buf,0,n);}finally{c.disconnect();}
            check(Arrays.equals(data,b.toByteArray()));check(transfer.await()==data.length);
        }
        Path target=root.resolve("target.apk");
        try(LoopbackTransfer transfer=new LoopbackTransfer(target.toFile(),true,()->true)){
            HttpURLConnection c=(HttpURLConnection)new URL(transfer.url()).openConnection(Proxy.NO_PROXY);c.setRequestMethod("PUT");c.setDoOutput(true);c.setFixedLengthStreamingMode(data.length);
            try(OutputStream out=c.getOutputStream()){out.write(data);}check(c.getResponseCode()==200);c.disconnect();check(transfer.await()==data.length);check(Arrays.equals(data,Files.readAllBytes(target)));
        }
        try{new LoopbackTransfer(target.toFile(),true,()->true);throw new AssertionError();}catch(IOException expected){check(Arrays.equals(data,Files.readAllBytes(target)));}
        Path interrupted=root.resolve("interrupted.apk");
        try(LoopbackTransfer transfer=new LoopbackTransfer(interrupted.toFile(),true,()->true)){
            URL u=new URL(transfer.url());try(Socket s=new Socket("127.0.0.1",u.getPort())){s.getOutputStream().write(("PUT "+u.getPath()+" HTTP/1.1\r\nContent-Length: 999\r\n\r\nx").getBytes("US-ASCII"));}
            try{transfer.await();throw new AssertionError();}catch(java.util.concurrent.ExecutionException expected){check(!Files.exists(interrupted));}
        }
        Path denied=root.resolve("denied.apk");
        try(LoopbackTransfer transfer=new LoopbackTransfer(denied.toFile(),true,()->true)){
            URL u=new URL(transfer.url());try(Socket s=new Socket("127.0.0.1",u.getPort())){s.getOutputStream().write("PUT /wrong-token HTTP/1.1\r\nContent-Length: 1\r\n\r\nx".getBytes("US-ASCII"));}
            try{transfer.await();throw new AssertionError();}catch(java.util.concurrent.ExecutionException expected){check(!Files.exists(denied));}
        }
        System.out.println("Loopback binary transfers: "+checks+" checks passed");
    }
}
