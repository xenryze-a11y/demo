import app.xen.xiaoxing.FilesBox;
import java.io.*;
import java.nio.file.*;

public class FilesBoxTest {
    interface Action {void run()throws Exception;}
    static int assertions=0;
    static void check(boolean b){assertions++;if(!b)throw new AssertionError();}
    static void rejects(Action a)throws Exception {assertions++;try{a.run();throw new AssertionError("Expected IOException");}catch(IOException expected){}}
    public static void main(String[] args)throws Exception {
        Path base=Files.createTempDirectory("xiaoxing-test");FilesBox box=new FilesBox(base.resolve("workspace").toFile());
        box.write("folder/hello.txt","你好🌟",false);check(box.read("folder/hello.txt").equals("你好🌟"));
        rejects(()->box.write("folder/hello.txt","overwrite",false));box.write("folder/hello.txt","new",true);check(box.read("folder/hello.txt").equals("new"));
        rejects(()->box.read("../secret"));rejects(()->box.write("../../secret","bad",true));rejects(()->box.resolve("/etc/passwd"));rejects(()->box.resolve("bad\0name"));
        Path outside=base.resolve("outside");Files.createDirectory(outside);Files.createSymbolicLink(base.resolve("workspace/link"),outside);
        rejects(()->box.write("link/secret","bad",true));rejects(()->box.write("huge",new String(new char[131073]),false));rejects(()->box.write("","oops",true));
        check(box.list("").contains("folder"));check(!Files.exists(outside.resolve("secret")));
        System.out.println("FilesBox: "+assertions+" checks passed");
    }
}
