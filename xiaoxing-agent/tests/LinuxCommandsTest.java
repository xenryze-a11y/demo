package app.xen.xiaoxing;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
public class LinuxCommandsTest {
    static int checks=0;
    static void check(boolean b){checks++;if(!b)throw new AssertionError();}
    public static void main(String[] args)throws Exception{
        check(LinuxCommands.quote("a'b").equals("'a'\"'\"'b'"));
        check(LinuxCommands.quote("$(echo bad)").equals("'$(echo bad)'"));
        check(LinuxCommands.timeout(-1)==5);check(LinuxCommands.timeout(999)==120);check(LinuxCommands.timeout(60)==60);
        check(LinuxCommands.result(0,"ok","").contains("Linux 退出码：0"));
        try{LinuxCommands.result(1,"Error: container 'xiaoxing' is not installed.","");throw new AssertionError();}catch(java.io.IOException e){check(e.getMessage().contains("缺少名为 xiaoxing 的 Debian 系统"));}
        try{LinuxCommands.result(7,"bad command","");throw new AssertionError();}catch(java.io.IOException e){check(e.getMessage().contains("退出码：7"));}
        check(LinuxCommands.containerCommand("python3 --version").endsWith("&& python3 --version"));
        try{LinuxCommands.containerCommand("bad\0cmd");throw new AssertionError();}catch(IllegalArgumentException expected){checks++;}
        try{LinuxCommands.cancelCommand(";rm -rf /");throw new AssertionError();}catch(IllegalArgumentException expected){checks++;}
        check(LinuxCommands.cancelCommand("a4d61844-d384-407f-9012-121b5eb7b332").contains("kill -TERM"));
        Files.write(Paths.get(args[0]),LinuxCommands.RUNNER.getBytes(StandardCharsets.UTF_8));
        System.out.println("Linux launch policy: "+checks+" checks passed");
    }
}
