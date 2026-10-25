# 圣剑联盟 APK 分片与合并说明

原文件：勇者阿信_4.0.6.apk。这里只拆分原始字节，没有修改 APK。

仓库上传接口存在请求体大小限制，因此此处使用 10 个不超过 10,000,000 字节的二进制分片。这组分片与聊天中提供的四份 ZIP 是不同的包装方案，最终还原为同一个 APK，不要混用两组分片。

## 在已有 Codex 项目中取用

保留当前开发分支，在项目根目录运行：

```bash
git fetch origin apk-source-20261025
git restore --source=origin/apk-source-20261025 -- research/apk
python3 research/apk/reassemble.py
```

合并结果为 `research/apk/sjlm_4.0.6.apk`。脚本核验每片及完整 APK 的 SHA256，并检测 APK 内全部 ZIP 条目的完整性。重复运行会核验已有结果，不会覆盖不同内容的文件。

完整 APK：99,267,482 字节。

SHA256：`74ba94f17ffcc3b02761ca701ca969c7a6be47ba1773296afdab61ee8e83d04e`

之后可使用 Python zipfile 等工具解包，分析 `assets/` 下的人物、动画、界面和配置，以及 `lib/armeabi/libcocos2dcpp.so`。原 APK 和原素材均未被修改，游戏源码分支无需切换或覆盖。
