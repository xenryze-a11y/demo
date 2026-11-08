package app.xen.xiaoxing;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.BooleanSupplier;

/** One-use, random-token file bridge bound to IPv4 loopback only. Never a public file server. */
final class LoopbackTransfer implements AutoCloseable {
    final ServerSocket server;
    final String token=UUID.randomUUID().toString()+UUID.randomUUID();
    final CompletableFuture<Long> result=new CompletableFuture<>();
    volatile Socket client;
    final File file;
    final boolean upload;
    LoopbackTransfer(File file,boolean upload,BooleanSupplier active)throws IOException {
        this(file,upload,active,120000);
    }
    LoopbackTransfer(File file,boolean upload,BooleanSupplier active,int acceptTimeout)throws IOException {
        this.file=file;this.upload=upload;
        if(upload&&file.exists())throw new IOException("目标文件已存在，禁止覆盖");
        if(!upload&&(!file.isFile()||file.length()>FilesBox.IMPORT_LIMIT))throw new IOException("源文件不存在或超过 256 MiB");
        server=new ServerSocket();server.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"),0));server.setSoTimeout(acceptTimeout);
        Thread thread=new Thread(()->serve(active),"xiaoxing-file-transfer");thread.setDaemon(true);thread.start();
    }
    String url(){return "http://127.0.0.1:"+server.getLocalPort()+"/"+token;}
    private void serve(BooleanSupplier active){
        File temporary=null;
        try(Socket socket=server.accept()){
            client=socket;socket.setSoTimeout(15000);InputStream in=socket.getInputStream();OutputStream out=socket.getOutputStream();
            String header=headers(in);String[] lines=header.split("\r\n");
            if(!lines[0].equals((upload?"PUT":"GET")+" /"+token+" HTTP/1.1"))throw new IOException("文件传输请求不匹配");
            if(upload){
                long length=-1;
                for(String line:lines){int colon=line.indexOf(':');if(colon<0)continue;String key=line.substring(0,colon).trim();String value=line.substring(colon+1).trim();if(key.equalsIgnoreCase("Transfer-Encoding"))throw new IOException("不接受分块上传");if(key.equalsIgnoreCase("Content-Length")){if(length!=-1)throw new IOException("重复长度");length=Long.parseLong(value);}}
                if(length<0||length>FilesBox.IMPORT_LIMIT)throw new IOException("传输超过 256 MiB 或没有容量信息");
                File parent=file.getParentFile();if(!parent.isDirectory()&&!parent.mkdirs())throw new IOException("无法创建目录");
                temporary=File.createTempFile(".transfer-",".part",parent);long remaining=length;
                try(OutputStream dest=new FileOutputStream(temporary)){byte[] b=new byte[16384];while(remaining>0){if(!active.getAsBoolean())throw new IOException("传输已停止");int n=in.read(b,0,(int)Math.min(b.length,remaining));if(n<0)throw new IOException("文件传输中断");dest.write(b,0,n);remaining-=n;}}
                Files.move(temporary.toPath(),file.toPath());temporary=null;
                out.write("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK".getBytes(StandardCharsets.US_ASCII));out.flush();result.complete(length);
            }else{
                long size=file.length();out.write(("HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: "+size+"\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
                try(InputStream src=new FileInputStream(file)){byte[] b=new byte[16384];int n;while((n=src.read(b))!=-1){if(!active.getAsBoolean())throw new IOException("传输已停止");out.write(b,0,n);}}out.flush();result.complete(size);
            }
        }catch(Exception e){result.completeExceptionally(e);}
        finally{if(temporary!=null)temporary.delete();try{server.close();}catch(IOException ignored){}}
    }
    private static String headers(InputStream in)throws IOException {
        ByteArrayOutputStream b=new ByteArrayOutputStream();int tail=0;
        while(b.size()<8192){int n=in.read();if(n<0)throw new IOException("请求头未完成");b.write(n);tail=(tail<<8)|n;if(tail==0x0d0a0d0a)return new String(b.toByteArray(),StandardCharsets.US_ASCII);}
        throw new IOException("请求头过大");
    }
    long await()throws Exception{return result.get(5,TimeUnit.SECONDS);}
    public void close(){try{server.close();}catch(IOException ignored){}Socket c=client;if(c!=null)try{c.close();}catch(IOException ignored){}}
}
