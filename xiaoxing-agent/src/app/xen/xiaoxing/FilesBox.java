package app.xen.xiaoxing;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/** Deliberately scoped to a dedicated workspace, never the app settings directory. */
public final class FilesBox {
    private final File root;
    public FilesBox(File root) throws IOException { this.root=root.getCanonicalFile(); if(!root.isDirectory()&&!root.mkdirs())throw new IOException("无法创建工作目录"); }
    public File resolve(String path) throws IOException {
        if(path==null||path.indexOf('\0')>=0||new File(path).isAbsolute())throw new IOException("只允许工作区相对路径");
        File f=new File(root,path).getCanonicalFile();
        if(!f.equals(root)&&!f.getPath().startsWith(root.getPath()+File.separator))throw new IOException("禁止访问工作区外的文件");
        return f;
    }
    public String read(String path) throws IOException { File f=resolve(path); if(!f.isFile()||f.length()>128*1024)throw new IOException("文件不存在或超过 128 KB"); return new String(Files.readAllBytes(f.toPath()),StandardCharsets.UTF_8); }
    public String write(String path,String text,boolean overwrite) throws IOException {
        File f=resolve(path); byte[] b=text.getBytes(StandardCharsets.UTF_8);
        if(b.length>128*1024)throw new IOException("单文件最多 128 KB");
        if(f.equals(root)||f.isDirectory())throw new IOException("路径必须是文件");
        if(f.exists()&&!overwrite)throw new IOException("文件已存在；确认用户要求覆盖后传入 overwrite=true");
        if(!f.getParentFile().isDirectory()&&!f.getParentFile().mkdirs())throw new IOException("无法创建目录");
        Files.write(f.toPath(),b); return "已写入 "+path+"（"+b.length+" 字节）";
    }
    public String list(String path) throws IOException {
        File f=resolve(path); if(!f.isDirectory())throw new IOException("不是目录");
        File[] all=f.listFiles(); if(all==null)throw new IOException("无法读取目录");
        StringBuilder out=new StringBuilder();int count=0;
        for(File x:all){if(++count>150){out.append("…目录过大，已截断");break;}out.append(x.isDirectory()?"[目录] ":"[文件] ").append(x.getName()).append(" ").append(x.length()).append("B\n");}
        return out.length()==0?"空目录":out.toString();
    }
}
