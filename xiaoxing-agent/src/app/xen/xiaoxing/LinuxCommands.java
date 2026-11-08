package app.xen.xiaoxing;

/** Kept independent of Android so quoting and launch policy can be tested on the JVM. */
final class LinuxCommands {
    static String quote(String text){return "'"+text.replace("'","'\"'\"'")+"'";}
    static int timeout(int seconds){return Math.max(5,Math.min(120,seconds));}
    static String result(int exit,String stdout,String stderr)throws java.io.IOException {
        String output=String.valueOf(stdout==null?"":stdout)+"\n"+String.valueOf(stderr==null?"":stderr);
        if(exit!=0){
            if(output.contains("container 'xiaoxing' is not installed"))throw new java.io.IOException("Linux 开发环境还没有安装完成。\n\n小星已经连接到 Termux，但缺少名为 xiaoxing 的 Debian 系统。请到 Linux 面板复制初始化指令，在 Termux 运行并等待「小星开发环境安装完成」。\n\n这是系统镜像未装成，不是模型密钥或手机操作权限错误。\n原始错误："+output);
            throw new java.io.IOException("Linux 命令未成功，退出码："+exit+"\n"+output);
        }
        return "Linux 退出码：0\n"+output;
    }
    static String containerCommand(String command){
        if(command==null||command.indexOf('\0')>=0||command.length()>24000)throw new IllegalArgumentException("Linux 命令为空、含空字符或超过 24000 字符");
        return "mkdir -p /root/xiaoxing-workspace && cd /root/xiaoxing-workspace && "+command;
    }
    static final String RUNNER=
        "import os,sys,subprocess,signal,time,pathlib,threading\n"+
        "token,limit,command=sys.argv[1],int(sys.argv[2]),sys.argv[3]\n"+
        "cache=pathlib.Path(os.environ.get('XIAOXING_CACHE_DIR',str(pathlib.Path.home()/'.cache'/'xiaoxing-agent')));cache.mkdir(parents=True,exist_ok=True)\n"+
        "pidfile=cache/(token+'.pid');buf=bytearray();total=[0]\n"+
        "container=sys.argv[5] if len(sys.argv)>5 else 'xiaoxing'\n"+
        "argv=['bash','-lc',command] if len(sys.argv)>4 and sys.argv[4]=='termux' else ['proot-distro','login',container,'--','/bin/bash','-lc',command]\n"+
        "p=subprocess.Popen(argv,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True)\n"+
        "pidfile.write_text(str(p.pid))\n"+
        "def read():\n"+
        " while True:\n"+
        "  part=p.stdout.read(1024)\n"+
        "  if not part: break\n"+
        "  total[0]+=len(part)\n"+
        "  if len(buf)<24000: buf.extend(part[:24000-len(buf)])\n"+
        "reader=threading.Thread(target=read,daemon=True);reader.start();timed=False\n"+
        "try:\n"+
        " try: p.wait(timeout=limit)\n"+
        " except subprocess.TimeoutExpired:\n"+
        "  timed=True\n"+
        "  try: os.killpg(p.pid,signal.SIGTERM)\n"+
        "  except ProcessLookupError: pass\n"+
        "  try: p.wait(timeout=3)\n"+
        "  except subprocess.TimeoutExpired:\n"+
        "   try: os.killpg(p.pid,signal.SIGKILL)\n"+
        "   except ProcessLookupError: pass\n"+
        "   p.wait()\n"+
        " reader.join(timeout=2);sys.stdout.write(buf.decode('utf-8','replace'))\n"+
        " if total[0]>len(buf): print('\\n[output truncated]')\n"+
        " if timed: print('\\n[command timeout]')\n"+
        "finally:\n"+
        " try: os.killpg(p.pid,signal.SIGKILL)\n"+
        " except ProcessLookupError: pass\n"+
        " pidfile.unlink(missing_ok=True)\n"+
        "sys.exit(124 if timed else (p.returncode if p.returncode>=0 else 128-p.returncode))\n";
    static String cancelCommand(String token){
        if(!token.matches("[a-f0-9-]{36}"))throw new IllegalArgumentException("Invalid execution token");
        return "p=\"$HOME/.cache/xiaoxing-agent/"+token+".pid\"; if [ -r \"$p\" ]; then n=$(cat \"$p\"); case \"$n\" in ''|*[!0-9]*) exit 1;; esac; kill -TERM -- -\"$n\" 2>/dev/null || true; fi";
    }
}
