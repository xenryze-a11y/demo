package app.xen.xiaoxing;

import android.content.Context;
import java.io.*;

final class SourceBundle {
    static String prepare(Context context,FilesBox box,String target)throws IOException {
        String archive;
        try(InputStream in=context.getAssets().open("self-source.zip")){archive=box.importFile("xiaoxing-source.zip",in,()->Agent.running);}
        return box.extract(archive,target,()->Agent.running)+"\n这是本 APK 内置的可编辑工程。先阅读 SELF-DEVELOPMENT.md。模型使用你自己的 API，继续修改无需 Codex 额度；运行、编译仍需 Linux/Android 构建工具。签名私钥不在源码中。";
    }
}
