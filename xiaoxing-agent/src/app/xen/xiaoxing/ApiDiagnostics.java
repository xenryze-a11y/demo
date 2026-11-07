package app.xen.xiaoxing;

import java.net.*;
import javax.net.ssl.SSLException;

/** Safe human-readable diagnostics. Never include request bodies or key fragments. */
final class ApiDiagnostics {
    static String lastReport="尚无诊断记录。可在设置里点「测试文字连接」。";
    static final class Failure extends Exception {
        Failure(String report){super(report);lastReport=report;}
    }
    static String redact(String value,String key){
        if(value==null)return "";
        if(key!=null&&!key.isEmpty())value=value.replace(key,"[密钥已隐藏]");
        return value.replaceAll("(?i)Bearer\\s+[A-Za-z0-9._*~+/-]+","Bearer [已隐藏]")
            .replaceAll("(?i)sk-[A-Za-z0-9_.*-]+","[密钥已隐藏]")
            .replaceAll("[\\p{Cntrl}&&[^\\n\\t]]","");
    }
    static String endpoint(String endpoint,String key){
        try{URL u=new URL(endpoint);return redact(u.getProtocol()+"://"+u.getHost()+(u.getPort()<0?"":":"+u.getPort())+u.getPath()+(u.getQuery()==null?"":"?[参数已隐藏]"),key);}catch(Exception e){return "[地址格式错误，请到设置检查]";}
    }
    static void validate(String endpoint,String key,String model)throws Failure {
        String problem=null;
        if(key==null||key.trim().isEmpty())problem="API Key 为空。请在设置里的 API Key 一栏填写服务商生成的完整密钥。";
        else if(key.startsWith("https://")||key.startsWith("http://"))problem="你把网址填进了 API Key 栏。这里需要平台控制台生成的私人密钥；接口网址请填在上方完整接口地址一栏。";
        else if(key.regionMatches(true,0,"Bearer ",0,7))problem="API Key 一栏多填了 Bearer 前缀。只粘贴密钥本身，App 会自动添加认证前缀。";
        else if(key.matches("(?s).*\\s.*"))problem="API Key 内含空白或换行，请重新复制完整密钥。";
        else if(key.indexOf('“')>=0||key.indexOf('”')>=0||key.indexOf('"')>=0||key.indexOf('\'')>=0)problem="API Key 含引号。请粘贴纯密钥，不要附带引号。";
        else if(model==null||model.trim().isEmpty())problem="模型名称为空，请填写你账号可用的模型名。";
        try{URL u=new URL(endpoint);if(!"https".equals(u.getProtocol())||u.getHost().isEmpty()||u.getUserInfo()!=null)problem="接口必须是 HTTPS 完整地址，且不能在地址中写账号或密码。";else if(!u.getPath().endsWith("/chat/completions"))problem="接口地址需要以 /chat/completions 结尾。这里填写完整接口地址，不是平台首页或仅 Base URL。";}catch(Exception e){problem="接口地址格式错误，请检查 https:// 和完整路径。";}
        if(problem!=null)throw new Failure(report("本地配置检查",endpoint,model,0,"",problem,"请点右上角设置，修改上述字段；没有发出 API 请求。",key));
    }
    static String report(String stage,String endpoint,String model,int status,String code,String detail,String advice,String key){
        String safeDetail=redact(detail,key);if(safeDetail.length()>1600)safeDetail=safeDetail.substring(0,1600)+"…[截断]";
        return "出错位置："+stage+"\n接口："+endpoint(endpoint,key)+"\n模型："+redact(model,key)+
            (status>0?"\nHTTP 状态："+status:"")+(code==null||code.isEmpty()?"":"\n服务商错误码："+redact(code,key))+
            "\n\n具体原因："+safeDetail+"\n\n怎么处理：\n"+advice+"\n\n密钥："+(key==null||key.isEmpty()?"未填写":"已填写，"+key.length()+" 个字符（内容隐藏）")+"\n未自动重试。";
    }
    static String advice(int status){
        switch(status){
            case 401:return "1. 确认密钥和接口来自同一家平台：智谱 Key 对应 open.bigmodel.cn；LongCat Key 对应 api.longcat.chat。\n2. 从该平台控制台重新创建/复制完整 API Key；不要填登录密码、验证码、网页 Cookie 或带星号的遮挡值。\n3. 确认 Key 未删除、过期或停用。修改后点「测试文字连接」。这一步与 PRoot/手机操作权限无关。";
            case 403:return "确认账号已开通该接口/模型权限，并检查平台的账号或 IP 限制；以服务商返回原因和控制台为准。";
            case 404:return "检查完整接口路径是否正确，以及模型名是否仍可用；不要把网页地址当 API 地址。";
            case 400:case 422:return "先运行「测试文字连接」。若文字通过而工具失败，检查模型的 function calling 支持；图片失败则检查视觉模型和图片格式。按服务商具体原因修改。";
            case 402:return "查看服务商控制台的余额、免费额度和模型计费权限。";
            case 429:return "可能是请求频率、并发或配额限制；查看服务商原因与控制台额度，稍后手动重试。";
            default:return status>=500?"服务商或网关暂时异常，请稍后手动重试；如持续出现，向服务商提供上面的错误码/请求编号。":"检查接口、模型和服务商返回原因；可复制这份已隐藏密钥的诊断记录。";
        }
    }
    static Failure transport(String stage,String endpoint,String model,Exception cause,String key){
        if(cause instanceof Failure)return (Failure)cause;
        String advice;
        if(cause instanceof UnknownHostException)advice="手机无法解析接口域名。检查网络、VPN/代理和域名拼写。";
        else if(cause instanceof SocketTimeoutException)advice="连接或读取超时。检查手机网络；可关闭深度思考后手动重试。";
        else if(cause instanceof SSLException)advice="TLS 安全连接失败。检查手机日期时间、证书和网络代理；App 不会关闭证书校验。";
        else advice="查看出错阶段和具体原因，检查网络/接口配置后手动重试。";
        return new Failure(report(stage,endpoint,model,0,"",cause.getClass().getSimpleName()+"："+String.valueOf(cause.getMessage()),advice,key));
    }
}
