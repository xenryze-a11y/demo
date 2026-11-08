import app.xen.xiaoxing.FilesBox;
import java.io.*;
import java.nio.file.*;
import java.util.zip.*;

public class FileImportTest {
    static int checks;
    interface Action{void run()throws Exception;}
    static void check(boolean b){checks++;if(!b)throw new AssertionError("check "+checks);}
    static void fails(Action a)throws Exception{checks++;try{a.run();throw new AssertionError("Expected failure");}catch(IOException expected){}}
    static void zip(Path p,String name,byte[] bytes)throws Exception{try(ZipOutputStream z=new ZipOutputStream(Files.newOutputStream(p))){z.putNextEntry(new ZipEntry(name));z.write(bytes);z.closeEntry();}}
    public static void main(String[] args)throws Exception {
        Path root=Files.createTempDirectory("xiaoxing-files");FilesBox box=new FilesBox(root.toFile());
        String text="你好🌟\n"+String.join("",java.util.Collections.nCopies(40000,"中文内容"));byte[] data=text.getBytes("UTF-8");
        String path=box.importFile("../../hello.txt",new ByteArrayInputStream(data),()->true);
        check(!path.contains("../"));check(box.resolve(path).length()==data.length);check(box.stat(path).contains(data.length+" 字节"));
        String page=box.readPage(path,6,13);check(page.contains(text.substring(6,19)));check(page.contains("next_offset=19 more=true"));
        check(box.readPage(path,text.length()-5,100).contains("more=false"));
        fails(()->box.readPage(path,-1,10));fails(()->box.readPage(path,Integer.MAX_VALUE,10));
        String binary=box.importFile("binary.dat",new ByteArrayInputStream(new byte[]{0,1,2}),()->true);fails(()->box.readPage(binary,0,100));
        String malformed=box.importFile("bad.txt",new ByteArrayInputStream(new byte[]{(byte)0xff,(byte)0xff}),()->true);fails(()->box.readPage(malformed,0,100));
        fails(()->box.importFile("stop",new ByteArrayInputStream(data),()->false));
        InputStream huge=new InputStream(){long remaining=FilesBox.IMPORT_LIMIT+1;public int read(){return remaining-->0?65:-1;}public int read(byte[] b,int o,int n){if(remaining<=0)return -1;int take=(int)Math.min(remaining,n);java.util.Arrays.fill(b,o,o+take,(byte)65);remaining-=take;return take;}};
        fails(()->box.importFile("huge",huge,()->true));
        try(java.util.stream.Stream<Path> stream=Files.walk(root)){check(stream.noneMatch(p->p.getFileName().toString().equals("huge")));}
        zip(root.resolve("good.zip"),"src/hello.java","你好源码".getBytes("UTF-8"));
        check(box.archive("good.zip","",0).contains("src/hello.java"));check(box.archive("good.zip","src/hello.java",0).contains("你好源码"));
        box.extract("good.zip","project",()->true);check(box.read("project/src/hello.java").equals("你好源码"));fails(()->box.extract("good.zip","project",()->true));
        box.pack("project","project.zip",()->true);check(box.archive("project.zip","src/hello.java",0).contains("你好源码"));fails(()->box.pack("project","project/inside.zip",()->true));
        zip(root.resolve("evil.zip"),"../escaped",new byte[]{1});fails(()->box.extract("evil.zip","bad-project",()->true));check(!Files.exists(root.resolve("escaped")));check(!Files.exists(root.resolve("bad-project")));
        try(ZipOutputStream z=new ZipOutputStream(Files.newOutputStream(root.resolve("bomb.zip")))){z.putNextEntry(new ZipEntry("bomb"));byte[] block=new byte[65536];for(int i=0;i<4112;i++)z.write(block);z.closeEntry();}fails(()->box.extract("bomb.zip","bomb-project",()->true));check(!Files.exists(root.resolve("bomb-project")));
        fails(()->box.extract("good.zip","cancelled",()->false));check(!Files.exists(root.resolve("cancelled")));
        Files.createSymbolicLink(root.resolve("project/link"),root.resolve("good.zip"));fails(()->box.pack("project","with-link.zip",()->true));check(!Files.exists(root.resolve("with-link.zip")));
        System.out.println("File imports/archives: "+checks+" checks passed");
    }
}
