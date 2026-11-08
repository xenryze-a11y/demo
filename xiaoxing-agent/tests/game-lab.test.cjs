// Shipped game script, minimal DOM fixture; no claim about browser/WebView rendering.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('assets/game-lab.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const orbs=[1,2,3].map(n=>({dataset:{step:String(n)},disabled:false}));
const status={textContent:'等待点击星核 01'};
vm.runInNewContext(script,{document:{querySelectorAll:()=>orbs,querySelector:()=>status},console:{log(){}},location:{reload(){}}});
orbs[1].onclick();assert(status.textContent.includes('顺序不对'));assert(!orbs[1].disabled);
orbs[0].onclick();assert(orbs[0].disabled);assert(status.textContent.includes('1 / 3'));
orbs[1].onclick();assert(orbs[1].disabled);assert(status.textContent.includes('2 / 3'));
orbs[2].onclick();assert(orbs[2].disabled);assert(status.textContent.includes('验证完成'));
console.log('Game lab script: wrong order, collected target state, progress and win state passed (DOM fixture only).');
