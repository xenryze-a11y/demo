package app.xen.xiaoxing;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.text.InputType;
import android.view.*;
import android.widget.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

public class MainActivity extends Activity implements Agent.Listener {
    private final int purple=0xffd6b66b,ink=0xffefece4;
    private LinearLayout feed,root;private ScrollView scroll;private EditText input;private TextView status,attachment;private Button send;
    private CheckBox phone,shell,linux,web,desktop;private String pendingImage,exportPath;
    private final ArrayList<String> pendingFiles=new ArrayList<>();
    private static boolean sessionLoaded;
    private static final ArrayList<String[]> transcript=new ArrayList<>();
    private boolean ready;
    private TextView computerState;private long computerCheckAt;private volatile boolean computerChecking;private final ExecutorService computerWorker=Executors.newSingleThreadExecutor();
    private FrameLayout panels;private LinearLayout chat;private ScrollView linuxPanel,capabilities;private TextView timer,linuxState,modelBadge;private EditText linuxInput;
    private final Handler clock=new Handler(Looper.getMainLooper());
    private final Runnable tick=new Runnable(){public void run(){if(computerState!=null){computerState.setText(SandboxInstallService.status(MainActivity.this));checkComputerInBackground();}if(timer!=null){long now=SystemClock.elapsedRealtime();if(Agent.busy){String wait=HumanControl.isUser()?"你正在接管 · AI 已暂停":Agent.requestStartedAt>0?String.format(java.util.Locale.ROOT,"响应等待 %.1f s",(now-Agent.requestStartedAt)/1000f):Agent.phase;timer.setText(wait+String.format(java.util.Locale.ROOT,"  ·  总计 %.1f s",(now-Agent.taskStartedAt)/1000f));status.setText("● "+Agent.phase+(Agent.currentRound>0?"  "+Agent.currentRound+"/"+Agent.roundLimit:""));}else if(Agent.lastRequestMillis>0)timer.setText(String.format(java.util.Locale.ROOT,"上轮响应 %.1f s",Agent.lastRequestMillis/1000f)+(Agent.tokenCount>0?"  ·  API 累计 "+Agent.tokenCount+" tokens":""));if(send!=null){send.setEnabled(true);send.setText(Agent.busy?"停止 ■":"发送 ↑");}if(phone!=null){phone.setEnabled(!Agent.busy);shell.setEnabled(!Agent.busy);linux.setEnabled(!Agent.busy);if(web!=null)web.setEnabled(!Agent.busy);if(desktop!=null)desktop.setEnabled(!Agent.busy);}}clock.postDelayed(this,200);}};
    int dp(int v){return (int)(getResources().getDisplayMetrics().density*v+.5f);}
    @Override public void onCreate(Bundle saved){super.onCreate(saved);Agent.listener=this;
        if(!sessionLoaded){if(!Agent.busy)Agent.history=SessionStore.load(this,"conversation");JSONArray old=SessionStore.load(this,"transcript");for(int i=0;i<old.length();i++){JSONArray row=old.optJSONArray(i);if(row!=null&&row.length()==2)transcript.add(new String[]{row.optString(0),row.optString(1)});}sessionLoaded=true;}
        build();if(saved!=null){ArrayList<String> old=saved.getStringArrayList("pendingFiles");if(old!=null)pendingFiles.addAll(old);exportPath=saved.getString("exportPath");refreshAttachment();}
        if(transcript.isEmpty())add("小星","你好，我是小星。\n\n联网已开启，可搜索和读取网页。点「＋ 附件」可导入文本、源码、ZIP、APK（单个最多 256 MiB）；点「文件」查看大小、预览或导出。文件只会在调用工具读取后把相应内容发给模型。\n\n已有模型配置保留。首次使用 Linux，请在 Linux 面板完成初始化。能力面板可以提取本应用源码，继续交给小星修改。");else for(String[] item:transcript)card(item[0],item[1]);ready=true;send.setEnabled(true);}
    @Override protected void onSaveInstanceState(Bundle out){super.onSaveInstanceState(out);out.putStringArrayList("pendingFiles",pendingFiles);out.putString("exportPath",exportPath);}
    @Override protected void onDestroy(){if(Agent.listener==this)Agent.listener=null;computerWorker.shutdownNow();super.onDestroy();}
    private GradientDrawable bg(int color,int radius){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d;}
    private GradientDrawable outline(int color,int stroke,int radius){GradientDrawable d=bg(color,radius);d.setStroke(dp(1),stroke);return d;}
    private TextView text(String t,int size){TextView v=new TextView(this);v.setText(t);v.setTextSize(size);v.setTextColor(ink);return v;}
    private Button button(String t,Runnable r){Button b=new Button(this);b.setText(t);b.setAllCaps(false);b.setMinWidth(0);b.setMinimumWidth(0);b.setMinHeight(dp(40));b.setPadding(dp(12),dp(4),dp(12),dp(4));b.setTextColor(purple);b.setTextSize(13);b.setBackground(new android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(0x33d6b66b),outline(0xff1a1e27,0xff34302a,12),null));b.setOnClickListener(v->r.run());return b;}

    private void build(){
        root=new LinearLayout(this);root.setOrientation(1);root.setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{0xff090b10,0xff11141b,0xff090b10}));root.setPadding(dp(16),dp(8),dp(16),dp(8));setContentView(root);
        if(Build.VERSION.SDK_INT>=30)root.setOnApplyWindowInsetsListener((v,i)->{android.graphics.Insets s=i.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.ime());v.setPadding(dp(16)+s.left,dp(8)+s.top,dp(16)+s.right,dp(8)+s.bottom);return i;});
        LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(0,dp(6),0,dp(12));
        ImageView mark=new ImageView(this);mark.setImageResource(R.drawable.launcher_art);top.addView(mark,new LinearLayout.LayoutParams(dp(48),dp(48)));
        LinearLayout brand=new LinearLayout(this);brand.setPadding(dp(10),0,0,0);brand.setOrientation(1);TextView name=text("小星",25);name.setTypeface(null,Typeface.BOLD);brand.addView(name);TextView sub=text("XIAOXING  /  PERSONAL AGENT",9);sub.setLetterSpacing(.12f);sub.setTextColor(purple);brand.addView(sub);top.addView(brand,new LinearLayout.LayoutParams(0,-2,1));top.addView(button("设置",this::settings));root.addView(top);
        LinearLayout nav=new LinearLayout(this);nav.setPadding(0,0,0,dp(10));nav.addView(button("对话",()->tab(0)),new LinearLayout.LayoutParams(0,dp(42),1));nav.addView(button("电脑",()->tab(1)),new LinearLayout.LayoutParams(0,dp(42),1));nav.addView(button("能力",()->tab(2)),new LinearLayout.LayoutParams(0,dp(42),1));root.addView(nav);
        LinearLayout rail=new LinearLayout(this);rail.setOrientation(1);rail.setPadding(dp(12),dp(10),dp(12),dp(10));rail.setBackground(outline(0xff11151d,0xff393125,12));
        status=text("● 待命 · 0.5.0 TEST",12);status.setTextColor(purple);rail.addView(status);timer=text("模型响应计时 · 等待任务",11);timer.setTextColor(0xff999ba7);timer.setPadding(0,dp(5),0,0);rail.addView(timer);root.addView(rail);
        panels=new FrameLayout(this);root.addView(panels,new LinearLayout.LayoutParams(-1,0,1));
        chat=new LinearLayout(this);chat.setOrientation(1);panels.addView(chat,new FrameLayout.LayoutParams(-1,-1));
        scroll=new ScrollView(this);scroll.setFillViewport(true);feed=new LinearLayout(this);feed.setOrientation(1);feed.setPadding(0,dp(14),0,dp(8));scroll.addView(feed);chat.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout options=new LinearLayout(this);phone=mode("手机");linux=mode("Linux");shell=mode("系统命令");options.addView(phone,new LinearLayout.LayoutParams(0,-2,1));options.addView(linux,new LinearLayout.LayoutParams(0,-2,1));options.addView(shell,new LinearLayout.LayoutParams(0,-2,1));chat.addView(options);modelBadge=text("",11);modelBadge.setTextColor(purple);modelBadge.setPadding(dp(3),dp(2),0,dp(8));modelBadge.setOnClickListener(v->settings());chat.addView(modelBadge);refreshModel();
        phone.setOnCheckedChangeListener((b,on)->{if(!on)return;if(PhoneService.instance==null){phone.setChecked(false);new AlertDialog.Builder(this).setTitle("连接手机操作").setMessage("在系统无障碍设置中，手动开启「小星 · 手机操作」，再回到这里勾选。任务中屏幕内容会交给你配置的模型，并可执行点击、输入、滑动。开启后有悬浮停止键。").setPositiveButton("去授权",(d,w)->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))).setNegativeButton("取消",null).show();}else new AlertDialog.Builder(this).setTitle("本次允许手机操作").setMessage("发送任务后可读取屏幕、截图和操作其他应用。屏幕内容会发给所配置的模型服务商。登录、验证码和支付请自己完成。").setPositiveButton("允许",null).setNegativeButton("取消",(d,w)->phone.setChecked(false)).setOnCancelListener(d->phone.setChecked(false)).show();});
        linux.setOnCheckedChangeListener((b,on)->{if(!on)return;if(!LinuxBridge.installed(this)||!LinuxBridge.granted(this)){linux.setChecked(false);tab(1);toast("先完成 Linux 面板里的初始化与授权");}else new AlertDialog.Builder(this).setTitle("连接 Linux 工作区").setMessage("AI 可以通过 Termux 在 PRoot Debian 中运行命令、写代码和测试。它具有 Termux 可访问文件的权限。命令默认从 /root/xiaoxing-workspace 开始，并有超时。").setPositiveButton("连接",null).setNegativeButton("取消",(d,w)->linux.setChecked(false)).setOnCancelListener(d->linux.setChecked(false)).show();});
        shell.setOnCheckedChangeListener((b,on)->{if(on)new AlertDialog.Builder(this).setTitle("Android 系统命令").setMessage("这是 Android sh，具有本 App 权限；不是 Linux 容器。默认关闭，单条命令 10 秒超时。编程任务优先连接 Linux。").setPositiveButton("启用",null).setNegativeButton("取消",(d,w)->shell.setChecked(false)).show();});
        web=mode("联网搜索 / 网页读取");web.setChecked(getSharedPreferences("config",0).getBoolean("web",true));web.setOnCheckedChangeListener((b,on)->getSharedPreferences("config",0).edit().putBoolean("web",on).apply());chat.addView(web);desktop=mode("独立电脑操作（可在后台工作）");desktop.setChecked(getSharedPreferences("desktop",0).getBoolean("offline_installed",false)&&getSharedPreferences("config",0).getBoolean("desktop_enabled",true));desktop.setOnCheckedChangeListener((b,on)->getSharedPreferences("config",0).edit().putBoolean("desktop_enabled",on).apply());chat.addView(desktop);
        attachment=text("",11);attachment.setTextColor(purple);attachment.setOnClickListener(v->{pendingImage=null;pendingFiles.clear();refreshAttachment();});chat.addView(attachment);
        LinearLayout composer=new LinearLayout(this);composer.setOrientation(1);composer.setPadding(dp(12),dp(8),dp(12),dp(8));composer.setBackground(outline(0xff171b24,0xff55452b,18));
        input=new EditText(this);input.setHint("交给小星一个任务…");input.setTextColor(ink);input.setHintTextColor(0xff757987);input.setTextSize(16);input.setMinLines(2);input.setMaxLines(4);input.setGravity(Gravity.TOP);input.setPadding(dp(2),dp(6),dp(2),dp(8));input.setBackgroundColor(Color.TRANSPARENT);composer.addView(input,new LinearLayout.LayoutParams(-1,-2));
        LinearLayout controls=new LinearLayout(this);controls.setGravity(Gravity.CENTER_VERTICAL);
        controls.addView(button("＋ 附件",this::pickAttachment));controls.addView(button("文件",()->showFiles("")));controls.addView(button("新建",this::newChat));
        send=button("发送 ↑",()->{if(Agent.busy){Agent.stop();status.setText("正在停止任务…");}else send();});send.setBackground(new android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(0x33ffffff),bg(purple,12),null));send.setTextColor(0xff111318);controls.addView(send,new LinearLayout.LayoutParams(0,dp(44),1));composer.addView(controls);chat.addView(composer);
        linuxPanel=panel();panels.addView(linuxPanel,new FrameLayout.LayoutParams(-1,-1));LinearLayout lp=(LinearLayout)linuxPanel.getChildAt(0);
        section(lp,"INDEPENDENT COMPUTER","小星的独立电脑");
        computerState=text(SandboxInstallService.status(this),14);computerState.setTextColor(purple);lp.addView(computerState);
        paragraph(lp,"安装包内置完整 ARM64 Linux 电脑：桌面、浏览器、文件管理器和文本编辑器。安装后 AI 可在后台操作，你可以实时看画面、开小窗，点「我来操作」暂停 AI 并接管，完成后「交还 AI」。系统在手机本地解包，需要至少 2 GiB 可用空间，以及已安装并授权的 Termux 宿主。");
        lp.addView(button("首次连接 Termux（仅首次需要）",()->copySetup("connect-termux.sh")));
        lp.addView(button("安装并启动内置独立电脑",this::startComputer));
        lp.addView(button("查看实时画面 / 临时接管 / 小窗",this::viewComputer));
        lp.addView(button("安装 Linux QQ（从腾讯官方下载）",()->computerAction("提交 QQ 安装",()->DesktopBridge.json(this,"/jobs",new JSONObject().put("kind","command").put("command",DesktopBridge.asset(this,"install-linux-qq.sh")).put("timeout_seconds",900)))));
        lp.addView(button("打开电脑里的 QQ",()->computerAction("打开 QQ",()->DesktopBridge.json(this,"/launch",new JSONObject().put("application","qq")))));
        lp.addView(button("检测电脑与安装日志",this::computerDiagnostic));
        lp.addView(button("停止电脑（结束运行中的程序）",()->computerAction("停止独立电脑",()->{String result=DesktopBridge.json(this,"/shutdown",new JSONObject());getSharedPreferences("desktop",0).edit().putString("setup_state","已请求停止电脑，系统和文件保留").apply();return result;})));
        lp.addView(button("取消正在进行的安装",()->startService(new Intent(this,SandboxInstallService.class).setAction("cancel"))));
        lp.addView(button("设置手机后台运行限制",()->startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))));
        paragraph(lp,"电脑支持安装 Linux 软件，包括相应 ARM64 版本的应用。Android APK 需要安卓客体系统；本地 Linux 电脑不会把它当 Linux 软件安装。登录账号时点「我来操作」，AI 会暂停截图、动作和命令。首次启动完成后状态会显示实际检测结果。");
        section(lp,"ADVANCED LINUX","原有开发环境与可选 APK 构建工具");
        section(lp,"LINUX WORKSPACE","手机上的开发工具环境");linuxState=text("",13);linuxState.setTextColor(purple);lp.addView(linuxState);paragraph(lp,"通过 Termux 连接 PRoot Debian。可运行 Python、Node、Git、构建与测试；不是安卓虚拟机。首次需要你在手机上初始化一次。");
        lp.addView(button("① 安装 / 打开 Termux",this::termux));lp.addView(button("② 复制初始化指令 → 在 Termux 粘贴运行",()->{try{copy("小星 Linux 初始化",LinuxBridge.setup(this));toast("已复制完整指令；去 Termux 长按粘贴并回车，等待出现 Setup complete");termux();}catch(Exception e){toast(e.getMessage());}}));lp.addView(button("③ 授予运行命令权限",this::grantLinux));lp.addView(button("④ 检测 Python / Node / Git",this::checkLinux));
        paragraph(lp,"初始化需要下载 Linux 和开发工具，请预留约 2 GB 可用空间；实际大小以下载结果为准。命令在你的手机执行，首次下载和安装可能需要数分钟。Android 后台限制可能中断任务。");
        TextView terminalTitle=text("手动命令 · 不调用模型 API",14);terminalTitle.setTextColor(purple);lp.addView(terminalTitle);linuxInput=new EditText(this);linuxInput.setTextColor(ink);linuxInput.setHintTextColor(0xff777d8b);linuxInput.setText("python3 --version");linuxInput.setTextSize(14);linuxInput.setTypeface(Typeface.MONOSPACE);linuxInput.setMinLines(2);lp.addView(linuxInput);lp.addView(button("执行 Linux 命令",()->{String cmd=linuxInput.getText().toString();if(!Agent.local(this,"Linux 命令",()->LinuxBridge.execute(this,cmd,60)))toast("已有任务运行中");}));lp.addView(button("■ 停止当前任务",()->Agent.stop()));lp.addView(button("查看最近 Linux 检测",()->showDiagnostic(getSharedPreferences("config",0).getString("linux_report","还没有检测记录"))));
        paragraph(lp,"本应用继续开发：安装一次 Android 构建工具后，可让小星提取本应用源码，通过 Termux 原生环境修改、编译并取回 APK。默认生成可并存测试版，覆盖升级需要原签名私钥。");
        lp.addView(button("安装 APK 构建工具 · 复制指令到 Termux",()->copySetup("setup-android-build.sh")));
        section(lp,"INDEPENDENT DESKTOP","独立 Linux 图形桌面");
        paragraph(lp,"Debian + Xfce + VNC/noVNC，可在独立终端保持运行。它共享手机内核和 Termux 权限，属于 PRoot 桌面；独立安卓虚拟手机需另接模拟器或云手机。桌面软件首次下载较大，建议额外预留 2 GiB 空间。QQ 等软件需另行安装，登录由你完成。");
        lp.addView(button("① 安装桌面软件 · 复制指令到 Termux",()->copySetup("setup-desktop.sh")));
        lp.addView(button("② 启动独立桌面（独立 Termux 会话）",()->Agent.local(this,"请求启动独立桌面",()->DesktopBridge.launch(this))));
        lp.addView(button("③ 检测独立桌面",()->Agent.local(this,"检测独立桌面",()->DesktopBridge.json(this,"/status",null))));
        lp.addView(button("④ 打开独立桌面",this::viewComputer));
        lp.addView(button("停止独立桌面",()->Agent.local(this,"停止独立桌面",()->DesktopBridge.json(this,"/shutdown",new JSONObject()))));
        paragraph(lp,"桌面启动后，可回到对话勾选「独立桌面操作」。AI 需要可用的视觉模型，先截图再操作，每次动作后重新检查。停止 AI 任务会停止后续工具调用；桌面会话由上方按钮单独停止。手机系统仍可能终止后台 Termux。");
        capabilities=panel();panels.addView(capabilities,new FrameLayout.LayoutParams(-1,-1));LinearLayout cp=(LinearLayout)capabilities.getChildAt(0);section(cp,"CAPABILITIES","能力与连接状态");paragraph(cp,"手机操作：无障碍页面读取、截图、文字输入、点击、滑动。画布游戏需按截图逐步操作；不保证即时动作游戏的速度与准确性。\n\n联网：web_search / web_read 由小星实际请求公网，无需 DeepSeek 内置搜索。搜索词、读取的文件内容会发给相应服务；可取消联网。\n\n文件：通用文件最多 256 MiB，长文本分页，APK/ZIP 可检查、提取；导出保留原始字节。PDF/Office 需 Linux 解析工具。\n\n继续开发：本 APK 内置完整可编辑源码，能力面板可提取。模型用你自己的 API，仍受服务商额度限制；构建工具需另装，原签名私钥由你保管。\n\n独立桌面：Linux 面板可安装、启动、检测、查看 Xfce。安卓虚拟手机尚需另外连接云手机或电脑模拟器。\n\nLinux：通过 Termux + PRoot 运行开发工具。完成初始化并检测通过后，才在对话里勾选 Linux。\n\nQQ / B站：普通界面操作使用手机模式。长期群机器人一般还要接官方机器人平台或其他消息桥；本版没有接消息监听服务，也不会自动登录或持续回复群消息。\n\n任务：默认 24 轮 / 10 分钟，可在设置调整到最多 64 轮 / 30 分钟。手机息屏、系统杀后台或模型限额都可能中断。\n\n计时：模型响应等待包含网络与推理；工具耗时单独显示，不代表模型内部纯思考时长。");cp.addView(button("手机无障碍授权",()->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))));cp.addView(button("打开本地游戏测试场",()->startActivity(new Intent(this,GamePreviewActivity.class))));cp.addView(button("模型设置与连接测试",this::settings));cp.addView(button("提取本应用源码（不调用模型）",()->Agent.local(this,"提取本应用源码",()->SourceBundle.prepare(this,new FilesBox(new File(getFilesDir(),"workspace")),"projects/xiaoxing-"+System.currentTimeMillis()))));cp.addView(button("检测真实网页联网（不调用模型）",()->Agent.local(this,"检测搜索 / 网页读取",()->WebTools.search("DeepSeek API 官方文档",()->Agent.running,c->Agent.connection=c)+"\n\n"+WebTools.read("https://api-docs.deepseek.com/",()->Agent.running,c->Agent.connection=c))));cp.addView(button("使用说明",this::help));
        tab(0);refreshLinux();
    }
    private CheckBox mode(String name){CheckBox b=new CheckBox(this);b.setText(name);b.setTextSize(12);b.setTextColor(0xffc3c1b9);return b;}
    private ScrollView panel(){ScrollView s=new ScrollView(this);LinearLayout l=new LinearLayout(this);l.setOrientation(1);l.setPadding(0,dp(18),0,dp(20));s.addView(l);return s;}
    private void section(LinearLayout l,String eyebrow,String title){TextView e=text(eyebrow,10);e.setLetterSpacing(.15f);e.setTextColor(purple);l.addView(e);TextView t=text(title,23);t.setTypeface(null,1);t.setPadding(0,dp(10),0,dp(16));l.addView(t);}
    private void paragraph(LinearLayout l,String value){TextView t=text(value,14);t.setTextColor(0xffb3b5bf);t.setLineSpacing(dp(5),1);t.setPadding(0,dp(14),0,dp(16));l.addView(t);}
    private void tab(int index){if(chat==null)return;chat.setVisibility(index==0?View.VISIBLE:View.GONE);linuxPanel.setVisibility(index==1?View.VISIBLE:View.GONE);capabilities.setVisibility(index==2?View.VISIBLE:View.GONE);if(index==1)refreshLinux();}
    private void newChat(){if(Agent.busy){toast("请先停止当前任务");return;}new AlertDialog.Builder(this).setMessage("开始新会话？已有工作区文件保留。").setPositiveButton("新会话",(d,w)->{Agent.history=new JSONArray();SessionStore.save(this,"conversation",Agent.history);transcript.clear();pendingFiles.clear();pendingImage=null;refreshAttachment();feed.removeAllViews();add("小星","新的任务，从这里开始。");}).setNegativeButton("取消",null).show();}
    private void checkComputerInBackground(){
        if(!Agent.busy&&desktop!=null&&getSharedPreferences("desktop",0).getBoolean("offline_installed",false)&&!getSharedPreferences("config",0).contains("desktop_enabled")){desktop.setChecked(true);getSharedPreferences("config",0).edit().putBoolean("desktop_enabled",true).apply();}
        long now=SystemClock.elapsedRealtime();if(computerChecking||SandboxInstallService.active()||now-computerCheckAt<5000||!getSharedPreferences("desktop",0).getBoolean("offline_installed",false))return;computerCheckAt=now;computerChecking=true;
        computerWorker.execute(()->{try{JSONObject state=new JSONObject(DesktopBridge.json(this,"/status",null));getSharedPreferences("desktop",0).edit().putString("setup_state",state.optBoolean("running")?("user".equals(state.optString("owner"))?"独立电脑运行中 · 你正在接管，AI 已暂停":"独立电脑运行中 · 可随时看画面或接管"):"电脑进程未就绪，查看日志后重新启动").apply();}catch(Exception e){getSharedPreferences("desktop",0).edit().putString("setup_state","暂未检测到独立电脑；系统和文件保留，可点「安装并启动」恢复").apply();}finally{computerChecking=false;}});
    }
    private void startComputer(){
        if(Agent.busy){toast("先结束当前 AI 任务，再安装或重启独立电脑；观看和接管不受这个限制");return;}
        if(!LinuxBridge.installed(this)){toast("先安装一次 Termux 宿主，之后由小星安装内置电脑");termux();return;}
        if(!LinuxBridge.granted(this)){requestPermissions(new String[]{LinuxBridge.PERMISSION},31);return;}
        try{startForegroundService(new Intent(this,SandboxInstallService.class));tab(1);toast("已开始准备独立电脑，可在此看状态或到 Termux 看安装进度");}catch(Exception e){showDiagnostic("无法开始安装："+e.getMessage());}
    }
    private void computerAction(String title,Callable<String> action){computerWorker.execute(()->{try{String result=action.call();runOnUiThread(()->{if(!isDestroyed())showDiagnostic(result);});}catch(Exception e){runOnUiThread(()->{if(!isDestroyed())showDiagnostic(title+"未完成："+e.getMessage());});}});}
    private void viewComputer(){computerWorker.execute(()->{try{DesktopBridge.viewer(this);}catch(Exception e){runOnUiThread(()->{if(!isDestroyed())showDiagnostic("暂时没有可查看的桌面："+e.getMessage()+"\n\n"+SandboxInstallService.status(this));});}});}
    private void computerDiagnostic(){computerAction("检测电脑",()->{String setup=SandboxInstallService.status(this);try{return setup+"\n\n"+DesktopBridge.json(this,"/status",null);}catch(IOException e){try{return setup+"\n\n"+DesktopBridge.json(this,"/setup/status",null);}catch(IOException ignored){return setup+"\n\n暂未收到电脑进程；Termux 安装会话的原始输出可帮助定位问题。";}}});}
    private void copySetup(String asset){try{copy("小星安装指令",DesktopBridge.asset(this,asset));toast("已复制；去 Termux 长按粘贴并回车，看到完成提示后回小星检测");termux();}catch(Exception e){toast(e.getMessage());}}
    private void copy(String label,String value){getSystemService(android.content.ClipboardManager.class).setPrimaryClip(ClipData.newPlainText(label,value));}
    private void termux(){if(LinuxBridge.installed(this)){Intent i=getPackageManager().getLaunchIntentForPackage("com.termux");if(i!=null){startActivity(i);return;}}open("https://f-droid.org/packages/com.termux/");}
    private void grantLinux(){if(!LinuxBridge.installed(this)){toast("请先安装 Termux");termux();return;}requestPermissions(new String[]{LinuxBridge.PERMISSION},30);}
    private void refreshLinux(){if(linuxState!=null)linuxState.setText(LinuxBridge.status(this));}
    private void refreshModel(){if(modelBadge!=null){android.content.SharedPreferences p=getSharedPreferences("config",0);modelBadge.setText(p.getString("model","glm-4.7-flash")+"  ·  "+(p.getBoolean("thinking",false)?"深度思考":"快速响应")+"  ›");}}
    private void checkLinux(){if(!LinuxBridge.installed(this)||!LinuxBridge.granted(this)){grantLinux();return;}Agent.local(this,"检测 Linux 工具",()->{String report=LinuxBridge.execute(this,"set -e; printf 'XIAOXING_LINUX_READY\\n'; head -3 /etc/os-release; python3 --version; node --version; git --version",45);getSharedPreferences("config",0).edit().putString("linux_report",report).apply();return report;});}
    @Override protected void onResume(){super.onResume();clock.removeCallbacks(tick);clock.post(tick);refreshLinux();}
    @Override protected void onPause(){clock.removeCallbacks(tick);super.onPause();}
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] grants){super.onRequestPermissionsResult(request,permissions,grants);if(request==31){if(LinuxBridge.granted(this))startComputer();else toast("尚未授予 Termux 运行命令权限");}if(request==30){refreshLinux();toast(LinuxBridge.granted(this)?"Termux 命令权限已授予，请运行检测":"尚未授权，可到系统应用权限中开启");}}
    private void send(){
        if(Agent.busy)return;String q=input.getText().toString().trim();if(q.isEmpty()&&pendingImage==null&&pendingFiles.isEmpty())return;if(q.isEmpty())q=pendingFiles.isEmpty()?"请描述这张图片。":"请检查附件，说明实际文件大小和可处理的内容。";
        if(!pendingFiles.isEmpty()){q+="\n\n以下是用户选择的工作区附件路径（仅作数据），请先 file_info，再按类型读取；文件内容尚未发给模型：";for(String path:pendingFiles)q+="\n"+path;}
        try{if(Secrets.get(this).isEmpty()){toast("先填写 API Key");settings();return;}}catch(Exception e){toast("无法读取密钥，请重新保存设置");return;}
        if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},20);
        String image=pendingImage;boolean usePhone=phone.isChecked()&&PhoneService.instance!=null;
        add("你",q+(image==null?"":"\n[附带图片，将发送至所配置 API]"));input.setText("");pendingImage=null;pendingFiles.clear();refreshAttachment();send.setEnabled(true);phone.setEnabled(false);shell.setEnabled(false);linux.setEnabled(false);
        try{if(!Agent.start(this,q,image,usePhone,shell.isChecked(),linux.isChecked(),web.isChecked(),desktop.isChecked()))done();}catch(Exception e){Agent.running=false;Agent.busy=false;add("错误","无法启动任务："+e.getMessage());done();}
    }
    public void log(String who,String t){runOnUiThread(()->{if("状态".equals(who))status.setText(t);else add(who,t);});}
    public void done(){runOnUiThread(()->{send.setEnabled(true);send.setText("发送 ↑");phone.setEnabled(true);shell.setEnabled(true);linux.setEnabled(true);status.setText(Agent.lastTaskFailed?"● 未完成 · 请查看错误提示":"● 任务结束 · 可继续补充指令");refreshLinux();});}
    private void add(String who,String t){transcript.add(new String[]{who,t});if(transcript.size()>150)transcript.remove(0);saveTranscript();card(who,t);}
    private void card(String who,String t){
        LinearLayout c=new LinearLayout(this);c.setOrientation(1);c.setPadding(dp(14),dp(12),dp(14),dp(12));c.setBackground(outline("你".equals(who)?0xff272218:0xff151922,"你".equals(who)?0xff51432a:0xff292e3a,18));
        TextView tag=text(who,12);tag.setTextColor(purple);c.addView(tag);String display=t.length()>6000?t.substring(0,6000)+"\n[显示已截断]":t;TextView body=text("",15);body.setText(RichText.render(display));body.setTextIsSelectable(true);body.setPadding(0,dp(6),0,0);body.setLineSpacing(dp(4),1);c.addView(body);if("小星".equals(who)&&Agent.lastRequestMillis>0){TextView meta=text(String.format(java.util.Locale.ROOT,"%s  ·  %.1f s",Agent.responseModel,Agent.lastRequestMillis/1000f),10);meta.setTextColor(0xff8f939f);meta.setPadding(0,dp(10),0,0);c.addView(meta);}if("错误".equals(who))c.addView(button("查看 / 复制这条错误",()->showDiagnostic(t)));if("结果".equals(who)){body.setVisibility(View.GONE);tag.setText("工具结果 · 点此展开 ▾");tag.setPadding(0,dp(6),0,dp(6));tag.setOnClickListener(v->{boolean closed=body.getVisibility()==View.GONE;body.setVisibility(closed?View.VISIBLE:View.GONE);tag.setText(closed?"工具结果 · 点此收起 ▴":"工具结果 · 点此展开 ▾");});}LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.bottomMargin=dp(10);feed.addView(c,lp);while(feed.getChildCount()>150)feed.removeViewAt(0);scroll.post(()->scroll.fullScroll(View.FOCUS_DOWN));
    }
    private EditText field(LinearLayout l,String label,String value,boolean secret){l.addView(text(label,13));EditText e=new EditText(this);e.setText(value);e.setTextColor(ink);e.setHintTextColor(0xff777d8b);e.setTextSize(14);e.setSingleLine(true);e.setInputType(secret?InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD:InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);l.addView(e);return e;}
    private void settings(){
        if(Agent.busy){toast("任务结束后可修改设置");return;}
        android.content.SharedPreferences p=getSharedPreferences("config",0);LinearLayout l=new LinearLayout(this);l.setPadding(dp(20),dp(10),dp(20),dp(10));l.setOrientation(1);ScrollView s=new ScrollView(this);s.addView(l);
        l.addView(text("密钥在手机上用 Android Keystore 加密保存。请求直接发给此接口；更换接口时请重新填写对应密钥。",13));
        EditText endpoint=field(l,"完整接口地址（含 /chat/completions）",p.getString("endpoint","https://open.bigmodel.cn/api/paas/v4/chat/completions"),false);
        EditText model=field(l,"文字模型",p.getString("model","glm-4.7-flash"),false);
        EditText vision=field(l,"视觉模型（不支持可留空）",p.getString("vision","glm-4.6v-flash"),false);
        CheckBox thinking=new CheckBox(this);thinking.setText("启用深度思考（支持的平台，较慢）");thinking.setChecked(p.getBoolean("thinking",false));l.addView(thinking);
        EditText rounds=field(l,"每个任务最多轮数（4~64，默认 24）",String.valueOf(p.getInt("rounds",24)),false);rounds.setInputType(InputType.TYPE_CLASS_NUMBER);
        EditText minutes=field(l,"每个任务最多分钟（1~30，默认 10）",String.valueOf(p.getInt("minutes",10)),false);minutes.setInputType(InputType.TYPE_CLASS_NUMBER);
        String old="";try{old=Secrets.get(this);}catch(Exception ignored){}EditText key=field(l,"API Key（不要发到群聊或发给我）",old,true);
        key.setHint("只填完整密钥本身，不要填 Bearer 或登录密码");
        l.addView(text("先点下面的文字测试，使用当前输入的配置，无需先保存。测试会调用接口，可能消耗少量额度。诊断不显示密钥内容。",12));
        l.addView(button("① 测试文字连接（先点这个）",()->probe(endpoint,key,model,false,false)));
        l.addView(button("② 测试工具参数",()->probe(endpoint,key,model,true,false)));
        l.addView(button("③ 测试视觉（发送一张金色测试图）",()->probe(endpoint,key,vision,false,true)));
        l.addView(button("查看 / 复制最近诊断",()->showDiagnostic(ApiDiagnostics.lastReport)));
        l.addView(button("填入智谱免费模型配置",()->{endpoint.setText("https://open.bigmodel.cn/api/paas/v4/chat/completions");model.setText("glm-4.7-flash");vision.setText("glm-4.6v-flash");key.setText("");}));
        l.addView(button("填入 LongCat 配置",()->{endpoint.setText("https://api.longcat.chat/openai/v1/chat/completions");model.setText("LongCat-2.5");vision.setText("LongCat-2.5");key.setText("");}));
        l.addView(button("填入 DeepSeek Flash 配置",()->{endpoint.setText("https://api.deepseek.com/chat/completions");model.setText("deepseek-flash");vision.setText("deepseek-flash");key.setText("");}));
        l.addView(text("额度、模型名称和权限以服务商控制台为准。截图中的 Preview 名称不一定是你的账号可用名称。接口需兼容 OpenAI Chat Completions 的工具调用。",12));
        l.addView(button("打开智谱开放平台",()->open("https://open.bigmodel.cn/")));l.addView(button("打开 LongCat 平台",()->open("https://longcat.chat/platform/")));
        AlertDialog d=new AlertDialog.Builder(this).setTitle("模型设置").setView(s).setPositiveButton("保存",null).setNegativeButton("取消",null).create();d.setOnShowListener(v->d.getButton(-1).setOnClickListener(w->{try{
            String url=endpoint.getText().toString().trim();java.net.URL u=new java.net.URL(url);ApiDiagnostics.validate(url,key.getText().toString().trim(),model.getText().toString().trim());
            int roundValue=Integer.parseInt(rounds.getText().toString()),minuteValue=Integer.parseInt(minutes.getText().toString());Secrets.save(this,key.getText().toString().trim());p.edit().putString("endpoint",url).putString("model",model.getText().toString().trim()).putString("vision",vision.getText().toString().trim()).putBoolean("thinking",thinking.isChecked()).putInt("rounds",Math.max(4,Math.min(64,roundValue))).putInt("minutes",Math.max(1,Math.min(30,minuteValue))).apply();Agent.history=new JSONArray();SessionStore.save(this,"conversation",Agent.history);refreshModel();d.dismiss();toast("已保存；模型上下文已重置");
        }catch(Exception e){toast("保存失败："+e.getMessage());}}));d.show();
    }
    private void probe(EditText endpoint,EditText key,EditText model,boolean tools,boolean image){
        if(Agent.busy){toast("已有任务或测试正在执行，请等待或停止");return;}
        String url=endpoint.getText().toString().trim(),secret=key.getText().toString().trim(),name=model.getText().toString().trim();
        try{ApiDiagnostics.validate(url,secret,name);}catch(ApiDiagnostics.Failure e){showDiagnostic(e.getMessage());return;}
        String sample=null;
        if(image){Bitmap b=Bitmap.createBitmap(32,32,Bitmap.Config.ARGB_8888);b.eraseColor(0xffd6ad57);ByteArrayOutputStream bytes=new ByteArrayOutputStream();b.compress(Bitmap.CompressFormat.PNG,100,bytes);b.recycle();sample="data:image/png;base64,"+android.util.Base64.encodeToString(bytes.toByteArray(),android.util.Base64.NO_WRAP);}
        status.setText("正在测试接口…可点停止任务终止");
        Agent.probe(url,secret,name,tools,sample,report->runOnUiThread(()->{if(!isDestroyed()){add("连接诊断",report);showDiagnostic(report);}}));
    }
    private void showDiagnostic(String report){
        TextView body=text(report,14);body.setTextIsSelectable(true);body.setPadding(dp(20),dp(12),dp(20),dp(12));ScrollView view=new ScrollView(this);view.addView(body);
        new AlertDialog.Builder(this).setTitle("具体诊断（密钥内容隐藏）").setView(view).setPositiveButton("复制诊断",(d,w)->{android.content.ClipboardManager cm=getSystemService(android.content.ClipboardManager.class);cm.setPrimaryClip(ClipData.newPlainText("小星诊断",report));toast("已复制诊断");}).setNegativeButton("关闭",null).show();
    }
    private void help(){new AlertDialog.Builder(this).setTitle("小星 0.5 · 独立电脑").setMessage("完整安装包内置 ARM64 Linux 桌面、轻量浏览器、编辑器和文件管理器。先连接并授权 Termux，然后在「电脑」点安装并启动；就绪后可让 AI 后台使用。首次解包请至少保留 2 GiB 空间。\n\n「查看实时画面」在 AI 工作时也可打开。「我来操作」暂停 AI 截图、点击与命令；「交还 AI」继续，必须重新观察画面。小窗通过系统画中画实时观看，展开后可接管。\n\n支持安装 Linux 软件；Android APK 需安卓客体系统。电脑面板有腾讯官方 Linux QQ 安装入口，登录由你接管。\n\nAndroid SDK 是编译 APK 的可选工具，日常使用电脑不需要它。模型用你自己的 API，仍有任务轮数、时间与服务商额度限制。\n\n保留旧 App；0.5 完整测试版可覆盖本项目 0.4 并存测试版，原 0.3 包需要原签名。手机端首次安装、画中画和后台策略仍需以真实检测与实际画面为准。").setPositiveButton("知道了",null).show();}
    private void open(String url){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception e){toast("没有可用的浏览器");}}
    private void toast(String m){Toast.makeText(this,m,Toast.LENGTH_LONG).show();}
    private void saveTranscript(){JSONArray rows=new JSONArray();for(String[] row:transcript)rows.put(new JSONArray().put(row[0]).put(row[1]));SessionStore.save(this,"transcript",rows);}
    private void pickAttachment(){
        if(Agent.busy){toast("请等待或停止当前任务后添加附件");return;}
        new AlertDialog.Builder(this).setTitle("添加附件").setItems(new String[]{"文件 / 源码 / ZIP / APK（每个最多 256 MiB）","图片（发给视觉模型）"},(d,w)->{
            Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType(w==0?"*/*":"image/*").addCategory(Intent.CATEGORY_OPENABLE);
            if(w==0)i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);startActivityForResult(i,w==0?12:10);
        }).setNegativeButton("取消",null).show();
    }
    private void refreshAttachment(){if(attachment!=null)attachment.setText((pendingImage==null?"":"✓ 图片已添加  ")+(pendingFiles.isEmpty()?"":"✓ "+pendingFiles.size()+" 个文件已就绪  ")+(pendingImage==null&&pendingFiles.isEmpty()?"":"· 点此移除本轮附件（文件保留）"));}
    private void importDocuments(Intent data){
        if(Agent.busy){toast("当前任务运行中，请结束后重新选择文件");return;}
        ArrayList<Uri> uris=new ArrayList<>();ClipData clip=data.getClipData();
        if(clip!=null){for(int i=0;i<clip.getItemCount();i++)uris.add(clip.getItemAt(i).getUri());}else if(data.getData()!=null)uris.add(data.getData());
        if(uris.size()+pendingFiles.size()>8){toast("每轮最多附加 8 个文件，请分批选择");return;}
        Agent.local(this,"导入附件",()->{
            FilesBox box=new FilesBox(new File(getFilesDir(),"workspace"));StringBuilder report=new StringBuilder();
            for(Uri uri:uris){
                try{
                    String name="attachment";long declared=-1;
                    try(android.database.Cursor c=getContentResolver().query(uri,new String[]{android.provider.OpenableColumns.DISPLAY_NAME,android.provider.OpenableColumns.SIZE},null,null,null)){
                        if(c!=null&&c.moveToFirst()){int n=c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME),z=c.getColumnIndex(android.provider.OpenableColumns.SIZE);if(n>=0&&!c.isNull(n))name=c.getString(n);if(z>=0&&!c.isNull(z))declared=c.getLong(z);}
                    }catch(Exception ignored){} // Some providers expose a stream without name/size metadata.
                    if(declared>FilesBox.IMPORT_LIMIT)throw new IOException("文件为 "+declared+" 字节，超过 256 MiB 上限");
                    String path;try(InputStream in=getContentResolver().openInputStream(uri)){if(in==null)throw new IOException("文件服务未提供内容");path=box.importFile(name,in,()->Agent.running);}
                    long size=box.resolve(path).length();report.append("已导入 ").append(path).append(" · ").append(size).append(" 字节\n");
                    runOnUiThread(()->{pendingFiles.add(path);refreshAttachment();});
                }catch(Exception e){report.append("未导入：").append(e.getMessage()).append("\n");}
                if(!Agent.running)break;
            }
            return report+"文件保存在小星工作区；发送任务后，模型通过工具读取所需部分。PDF/Office 等格式需对应解析工具，导入成功不代表内容已解析。";
        });
    }
    private void showFiles(String path){try{
        FilesBox box=new FilesBox(new File(getFilesDir(),"workspace"));File dir=box.resolve(path);File[] fs=dir.listFiles();if(fs==null)throw new IOException("无法读取目录");
        Arrays.sort(fs,Comparator.comparing(File::getName));String[] labels=new String[fs.length];for(int i=0;i<fs.length;i++)labels[i]=(fs[i].isDirectory()?"📁 ":"")+fs[i].getName()+(fs[i].isFile()?" · "+fs[i].length()+" B":"");
        new AlertDialog.Builder(this).setTitle("工作区 /"+path).setItems(labels,(d,w)->{
            String p=path.isEmpty()?fs[w].getName():path+"/"+fs[w].getName();if(fs[w].isDirectory()){showFiles(p);return;}
            new AlertDialog.Builder(this).setTitle(fs[w].getName()+" · "+fs[w].length()+" 字节").setItems(new String[]{"附加到下一条消息","预览文本（首 6000 字符）","检查 APK / ZIP 目录","导出原文件"},(dd,action)->{
                try{
                    if(action==0){if(pendingFiles.size()>=8)throw new IOException("本轮已有 8 个文件");if(!pendingFiles.contains(p))pendingFiles.add(p);refreshAttachment();return;}
                    if(action==3){exportPath=p;startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/octet-stream").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,fs[w].getName()),11);return;}
                    showDiagnostic(action==1?box.readPage(p,0,6000):box.archive(p,"",0));
                }catch(Exception e){toast(e.getMessage());}
            }).setNegativeButton("关闭",null).show();
        }).setNeutralButton(path.isEmpty()?"导入文件":"上一级",(d,w)->{if(path.isEmpty())pickAttachment();else{int slash=path.lastIndexOf('/');showFiles(slash<0?"":path.substring(0,slash));}}).setNegativeButton("关闭",null).show();
    }catch(Exception e){toast(e.getMessage());}}
    @Override protected void onActivityResult(int req,int result,Intent data){super.onActivityResult(req,result,data);if(result!=RESULT_OK||data==null)return;if(req==12){importDocuments(data);return;}if(data.getData()==null)return;
        try{
            if(req==11){
                if(exportPath==null){toast("导出路径已失效，请重新选择文件");return;}
                String path=exportPath;Uri uri=data.getData();
                if(!Agent.local(this,"导出文件",()->{FilesBox box=new FilesBox(new File(getFilesDir(),"workspace"));try(InputStream in=new FileInputStream(box.resolve(path));OutputStream out=getContentResolver().openOutputStream(uri)){if(out==null)throw new IOException("无法打开目标文件");byte[] buf=new byte[16384];int n;while((n=in.read(buf))!=-1){if(!Agent.running)throw new IOException("导出已停止，目标可能不完整，请重新导出");out.write(buf,0,n);}}return "已导出原文件："+path;}))toast("已有任务运行，请完成后重新导出");return;
            }
            if(req==10){Uri uri=data.getData();BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;try(InputStream in=getContentResolver().openInputStream(uri)){BitmapFactory.decodeStream(in,null,bounds);}if(bounds.outWidth<1||bounds.outHeight<1)throw new IOException("无法读取图片");BitmapFactory.Options o=new BitmapFactory.Options();o.inSampleSize=1;while(Math.max(bounds.outWidth,bounds.outHeight)/o.inSampleSize>1600)o.inSampleSize*=2;
                Bitmap bitmap;try(InputStream in=getContentResolver().openInputStream(uri)){bitmap=BitmapFactory.decodeStream(in,null,o);}if(bitmap==null)throw new IOException("图片解码失败");ByteArrayOutputStream b=new ByteArrayOutputStream();bitmap.compress(Bitmap.CompressFormat.JPEG,80,b);bitmap.recycle();pendingImage="data:image/jpeg;base64,"+android.util.Base64.encodeToString(b.toByteArray(),android.util.Base64.NO_WRAP);refreshAttachment();
            }
        }catch(Exception e){toast("操作失败："+e.getMessage());}
    }
}
