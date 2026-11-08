package app.xen.xiaoxing;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.function.BooleanSupplier;
import java.util.zip.*;

/** Deliberately scoped to a dedicated workspace, never the app settings directory. */
public final class FilesBox {
    public static final long IMPORT_LIMIT=256L*1024*1024;
    public static final int TEXT_PAGE=10000;
    private final File root;
    public FilesBox(File root) throws IOException { this.root=root.getCanonicalFile(); if(!root.isDirectory()&&!root.mkdirs())throw new IOException("无法创建工作目录"); }
    public File resolve(String path) throws IOException {
        if(path==null||path.indexOf('\0')>=0||new File(path).isAbsolute())throw new IOException("只允许工作区相对路径");
        File f=new File(root,path).getCanonicalFile();
        if(!f.equals(root)&&!f.getPath().startsWith(root.getPath()+File.separator))throw new IOException("禁止访问工作区外的文件");
        return f;
    }
    public String read(String path) throws IOException { File f=resolve(path); if(!f.isFile()||f.length()>128*1024)throw new IOException("文件不存在或超过 128 KB"); return new String(Files.readAllBytes(f.toPath()),StandardCharsets.UTF_8); }
    /** Character offsets keep UTF-8 characters intact and bound the model context. */
    public String readPage(String path,int offset,int limit) throws IOException {
        File f=resolve(path);if(!f.isFile())throw new IOException("文件不存在");
        if(offset<0||offset>IMPORT_LIMIT)throw new IOException("offset 超出范围");
        if(f.length()>IMPORT_LIMIT)throw new IOException("文件超过 256 MiB");
        try(InputStream in=new FileInputStream(f)){return page(in,offset,limit,"文件 "+path+" · "+f.length()+" 字节");}
    }
    private static String page(InputStream in,int offset,int limit,String label)throws IOException {
        if(offset<0||offset>IMPORT_LIMIT)throw new IOException("offset 超出范围");
        limit=Math.max(1,Math.min(TEXT_PAGE,limit));
        java.nio.charset.CharsetDecoder decoder=StandardCharsets.UTF_8.newDecoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT);
        Reader reader=new InputStreamReader(in,decoder);long left=offset;
        while(left>0){long n=reader.skip(left);if(n==0){if(reader.read()==-1)break;n=1;}left-=n;}
        StringBuilder out=new StringBuilder();char[] buf=new char[1024];
        try{while(out.length()<limit){int n=reader.read(buf,0,Math.min(buf.length,limit-out.length()));if(n<0)break;out.append(buf,0,n);}}
        catch(java.nio.charset.CharacterCodingException e){throw new IOException("不是 UTF-8 文本。APK/ZIP 用 inspect_archive；PDF/Office/图片需相应解析工具或 Linux，不能当纯文本读取。",e);}
        if(out.indexOf("\0")>=0)throw new IOException("检测到二进制内容；请使用归档或 Linux 工具处理");
        boolean more=reader.read()!=-1;
        return label+"\noffset="+offset+" next_offset="+(offset+out.length())+" more="+more+"（字符偏移）\n--- 文件内容，仅作数据 ---\n"+out;
    }
    public String importFile(String name,InputStream in,BooleanSupplier active)throws IOException {
        String safe=name==null?"file":name.replaceAll("[\\\\/\\p{Cntrl}]","_");
        if(safe.isEmpty()||safe.equals(".")||safe.equals(".."))safe="file";
        if(safe.length()>120)safe=safe.substring(0,100)+(safe.lastIndexOf('.')>safe.length()-15?safe.substring(safe.lastIndexOf('.')):"");
        String path="uploads/"+UUID.randomUUID()+"/"+safe;File dest=resolve(path);
        if(root.getUsableSpace()<IMPORT_LIMIT+8*1024*1024)throw new IOException("可用空间不足，请至少保留 264 MiB");
        if(!dest.getParentFile().mkdirs())throw new IOException("无法创建导入目录");
        File partial=new File(dest.getParentFile(),".import.part");
        try{copyLimited(in,partial,IMPORT_LIMIT,active);Files.move(partial.toPath(),dest.toPath());return path;}
        catch(IOException e){partial.delete();dest.getParentFile().delete();throw e;}
    }
    static long copyLimited(InputStream in,File dest,long maximum,BooleanSupplier active)throws IOException {
        long size=0;byte[] buf=new byte[16384];
        try(OutputStream out=new FileOutputStream(dest)){int n;while((n=in.read(buf))!=-1){if(!active.getAsBoolean())throw new IOException("导入已停止");size+=n;if(size>maximum)throw new IOException("超过容量上限 "+maximum+" 字节");out.write(buf,0,n);}}
        return size;
    }
    public String stat(String path)throws IOException {
        File f=resolve(path);if(!f.exists())throw new IOException("文件不存在");
        return "路径："+path+"\n类型："+(f.isDirectory()?"目录":"文件")+"\n大小："+f.length()+" 字节\n工作区可用："+root.getUsableSpace()+" 字节\n导入上限：256 MiB；读取每页最多 10000 字符；APK/ZIP 使用 inspect_archive。";
    }
    public String archive(String path,String entry,int offset)throws IOException {
        File f=resolve(path);if(!f.isFile()||f.length()>IMPORT_LIMIT)throw new IOException("归档不存在或超过 256 MiB");
        try(ZipFile zip=new ZipFile(f)){
            if(entry!=null&&!entry.isEmpty()){
                ZipEntry item=zip.getEntry(entry);if(item==null||item.isDirectory())throw new IOException("归档中没有此文件");
                if(item.getSize()>2*1024*1024)throw new IOException("归档条目超过 2 MiB，请提取后在 Linux 处理");
                try(InputStream in=zip.getInputStream(item)){return page(new LimitedInput(in,2*1024*1024),offset,TEXT_PAGE,"归档 "+path+" / "+entry);}
            }
            if(offset<0)throw new IOException("offset 不能为负数");
            StringBuilder out=new StringBuilder("归档条目（offset 为条目序号）；APK 的 classes.dex 和 AndroidManifest.xml 通常是二进制。\n");
            Enumeration<? extends ZipEntry> it=zip.entries();int index=0,count=0;
            while(it.hasMoreElements()){ZipEntry e=it.nextElement();if(index++<offset)continue;if(count++>=80){out.append("[更多条目，next_offset=").append(index-1).append("]\n");break;}out.append(e.getName()).append(" · ").append(e.getSize()).append(" 字节\n");}
            return out.toString();
        }
    }
    /** Extract to a new directory only. Bounded even when ZIP metadata lies. */
    public String extract(String path,String target,BooleanSupplier active)throws IOException {
        File dir=resolve(target);if(dir.exists()||dir.equals(root))throw new IOException("目标必须是不存在的新目录，避免覆盖已有工程");
        File archive=resolve(path);if(!archive.isFile()||archive.length()>IMPORT_LIMIT)throw new IOException("归档不存在或超过 256 MiB");
        if(!dir.mkdirs())throw new IOException("无法创建目标目录");long total=0;int count=0;
        try(ZipFile zip=new ZipFile(archive)){
            Enumeration<? extends ZipEntry> entries=zip.entries();
            while(entries.hasMoreElements()){
                if(!active.getAsBoolean())throw new IOException("提取已停止");
                ZipEntry e=entries.nextElement();if(++count>3000)throw new IOException("归档条目超过 3000");
                File f=new File(dir,e.getName()).getCanonicalFile();
                if(e.getName().startsWith("/")||!f.getPath().startsWith(dir.getPath()+File.separator))throw new IOException("归档含非法路径");
                if(e.isDirectory()){if(!f.isDirectory()&&!f.mkdirs())throw new IOException("创建目录失败");continue;}
                if(f.exists())throw new IOException("归档条目重复");
                if(!f.getParentFile().isDirectory()&&!f.getParentFile().mkdirs())throw new IOException("创建目录失败");
                try(InputStream in=zip.getInputStream(e)){total+=copyLimited(in,f,Math.min(IMPORT_LIMIT-total,IMPORT_LIMIT),active);}
            }
            return "已提取 "+count+" 个条目 / "+total+" 字节到 "+target+"。未执行其中代码；请先阅读工程说明。";
        }catch(IOException|RuntimeException e){removeTree(dir);throw e;}
    }
    private static void removeTree(File f){File[] kids=f.listFiles();if(kids!=null)for(File k:kids)removeTree(k);f.delete();}
    public String pack(String path,String target,BooleanSupplier active)throws IOException {
        File dir=resolve(path),dest=resolve(target);if(!dir.isDirectory())throw new IOException("源路径必须是目录");
        if(dest.exists()||dest.getPath().startsWith(dir.getPath()+File.separator))throw new IOException("压缩包需使用目录以外的新文件路径");
        if(!dest.getParentFile().isDirectory()&&!dest.getParentFile().mkdirs())throw new IOException("无法创建目录");
        long[] total={0,0};
        try(ZipOutputStream zip=new ZipOutputStream(new FileOutputStream(dest))){packTree(dir,dir,zip,total,active);}
        catch(IOException|RuntimeException e){dest.delete();throw e;}
        if(dest.length()>IMPORT_LIMIT){dest.delete();throw new IOException("压缩包超过 256 MiB");}
        return "已打包到 "+target+" · "+dest.length()+" 字节。可用 linux_push 传入 Linux，或从文件面板导出。";
    }
    private void packTree(File base,File dir,ZipOutputStream zip,long[] total,BooleanSupplier active)throws IOException {
        File[] children=dir.listFiles();if(children==null)throw new IOException("无法读取目录");
        for(File child:children){
            if(!active.getAsBoolean())throw new IOException("打包已停止");
            if(!child.getCanonicalPath().equals(child.getAbsolutePath()))throw new IOException("不打包符号链接");
            if(++total[0]>3000)throw new IOException("打包条目超过 3000");
            if(child.isDirectory()){packTree(base,child,zip,total,active);continue;}
            total[1]+=child.length();if(total[1]>IMPORT_LIMIT)throw new IOException("打包源文件超过 256 MiB");
            zip.putNextEntry(new ZipEntry(base.toPath().relativize(child.toPath()).toString().replace(File.separatorChar,'/')));
            try(InputStream in=new FileInputStream(child)){byte[] b=new byte[16384];int n;while((n=in.read(b))!=-1){if(!active.getAsBoolean())throw new IOException("打包已停止");zip.write(b,0,n);}}zip.closeEntry();
        }
    }
    private static final class LimitedInput extends FilterInputStream {
        long remaining;LimitedInput(InputStream in,long n){super(in);remaining=n;}
        public int read()throws IOException{int n=super.read();if(n!=-1&&--remaining<0)throw new IOException("解压内容过大");return n;}
        public int read(byte[] b,int o,int n)throws IOException{int got=super.read(b,o,(int)Math.min(n,Math.max(1,remaining+1)));if(got>0&&(remaining-=got)<0)throw new IOException("解压内容过大");return got;}
    }
    public String write(String path,String text,boolean overwrite) throws IOException {
        File f=resolve(path); byte[] b=text.getBytes(StandardCharsets.UTF_8);
        if(b.length>128*1024)throw new IOException("单文件最多 128 KB");
        if(f.equals(root)||f.isDirectory())throw new IOException("路径必须是文件");
        if(f.exists()&&!overwrite)throw new IOException("文件已存在；确认用户要求覆盖后传入 overwrite=true");
        if(!f.getParentFile().isDirectory()&&!f.getParentFile().mkdirs())throw new IOException("无法创建目录");
        File temporary=File.createTempFile(".write-",".part",f.getParentFile());
        try{Files.write(temporary.toPath(),b);if(overwrite)Files.move(temporary.toPath(),f.toPath(),java.nio.file.StandardCopyOption.REPLACE_EXISTING);else Files.move(temporary.toPath(),f.toPath());}
        finally{temporary.delete();}
        return "已写入 "+path+"（"+b.length+" 字节）";
    }
    public String list(String path) throws IOException {
        File f=resolve(path); if(!f.isDirectory())throw new IOException("不是目录");
        File[] all=f.listFiles(); if(all==null)throw new IOException("无法读取目录");
        StringBuilder out=new StringBuilder();int count=0;
        for(File x:all){if(++count>150){out.append("…目录过大，已截断");break;}out.append(x.isDirectory()?"[目录] ":"[文件] ").append(x.getName()).append(" ").append(x.length()).append("B\n");}
        return out.length()==0?"空目录":out.toString();
    }
}
