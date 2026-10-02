import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath,['--check','src/game.js'],{stdio:'inherit'});
execFileSync(process.execPath,['--check','src/data.js'],{stdio:'inherit'});
rmSync('dist',{recursive:true,force:true});mkdirSync('dist/src',{recursive:true});
for(const file of ['index.html','src/game.js','src/data.js','src/style.css']) cpSync(file,`dist/${file}`);
console.log('Production build created in dist/');
