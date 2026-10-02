import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), process.argv[2] || '.');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
createServer((req,res)=>{
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file = normalize(join(root, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file=join(root,'index.html');
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
  res.setHeader('Cache-Control','no-cache');createReadStream(file).pipe(res);
}).listen(4173,'0.0.0.0',()=>console.log('Cathedral of Ash: http://localhost:4173'));
