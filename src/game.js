import { WORLD, skills, itemTypes, enemyTypes, obstacles } from './data.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const ui = Object.fromEntries(['start','death','begin','retry','skills','hpText','manaText','xpFill','level','inventory','bag','gear','toast','bagButton','closeBag','questText','bossbar'].map(id=>[id,document.querySelector('#'+id)]));
const input={keys:new Set(),mouse:{x:0,y:0,down:false},touch:{x:0,y:0}};
let running=false,last=0,time=0,camera={x:0,y:0},shake=0,particles=[],projectiles=[],loot=[];

const player={x:250,y:300,radius:18,speed:190,hp:100,maxHp:100,mana:100,maxMana:100,damage:18,armor:0,crit:0,xp:0,level:1,facing:0,attackCd:0,skillCd:[0,0,0],inventory:[],gear:{weapon:null,helm:null,armor:null,ring:null}};
let enemies=[];

function resize(){canvas.width=innerWidth*devicePixelRatio;canvas.height=innerHeight*devicePixelRatio;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}
addEventListener('resize',resize);resize();
addEventListener('keydown',e=>{input.keys.add(e.key.toLowerCase());if('123'.includes(e.key))cast(+e.key-1);if(e.key.toLowerCase()==='i')toggleBag();if(e.key.toLowerCase()==='e')pickup()});
addEventListener('keyup',e=>input.keys.delete(e.key.toLowerCase()));
canvas.addEventListener('pointermove',e=>{input.mouse.x=e.clientX;input.mouse.y=e.clientY});
canvas.addEventListener('pointerdown',()=>input.mouse.down=true);addEventListener('pointerup',()=>input.mouse.down=false);

const joystick=document.querySelector('#joystick'),stick=joystick.querySelector('i');
function moveStick(e){const r=joystick.getBoundingClientRect(),x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2),m=Math.hypot(x,y)||1,limit=35;input.touch.x=Math.abs(x)<8?0:x/Math.max(m,limit);input.touch.y=Math.abs(y)<8?0:y/Math.max(m,limit);stick.style.transform=`translate(${input.touch.x*limit}px,${input.touch.y*limit}px)`}
joystick.addEventListener('pointerdown',e=>{joystick.setPointerCapture(e.pointerId);moveStick(e)});joystick.addEventListener('pointermove',e=>{if(joystick.hasPointerCapture(e.pointerId))moveStick(e)});joystick.addEventListener('pointerup',()=>{input.touch.x=input.touch.y=0;stick.style.transform='' });
document.querySelectorAll('#touchSkills [data-skill]').forEach(el=>el.addEventListener('pointerdown',e=>{e.preventDefault();cast(+el.dataset.skill)}));
const attackButton=document.querySelector('#touchAttack');attackButton.addEventListener('pointerdown',e=>{e.preventDefault();input.mouse.down=true});attackButton.addEventListener('pointerup',()=>input.mouse.down=false);attackButton.addEventListener('pointercancel',()=>input.mouse.down=false);
document.querySelector('#touchPickup').addEventListener('pointerdown',e=>{e.preventDefault();pickup()});

skills.forEach((s,i)=>{const el=document.createElement('button');el.className='skill';el.style.setProperty('--c',s.color);el.title=`${s.name}：${s.description}`;el.innerHTML=`<kbd>${s.key}</kbd><em>${s.icon}</em><small>${s.name}</small><i class="cool"></i>`;el.onclick=()=>cast(i);ui.skills.append(el)});
ui.begin.onclick=()=>start(false);ui.retry.onclick=()=>start(true);ui.bagButton.onclick=toggleBag;ui.closeBag.onclick=toggleBag;

function start(reset){
  if(reset) Object.assign(player,{x:250,y:300,hp:player.maxHp,mana:player.maxMana,xp:Math.max(0,player.xp-20)});
  enemies=[];loot=[];projectiles=[];particles=[];
  const spots=[[520,300],[780,560],[1020,500],[1260,330],[1550,600],[1880,520],[2190,400],[450,1150],[800,1050],[1080,1500],[1450,1050],[1750,1280],[2100,1050],[2300,1550]];
  spots.forEach((p,i)=>spawnEnemy(i%4===0?'cultist':i%3===0?'wraith':'ghoul',p[0],p[1]));
  spawnEnemy('boss',2300,1650);ui.start.classList.add('hidden');ui.death.classList.add('hidden');running=true;last=performance.now();requestAnimationFrame(loop);toast('进入灰烬墓园');
}
function spawnEnemy(type,x,y){const t=enemyTypes[type];enemies.push({...t,type,x,y,maxHp:t.hp,hit:0,attackCd:0,phase:Math.random()*6.28,dead:false})}

function loop(now){if(!running)return;const dt=Math.min(.033,(now-last)/1000);last=now;time+=dt;update(dt);draw();requestAnimationFrame(loop)}
function update(dt){
  let dx=(input.keys.has('d')?1:0)-(input.keys.has('a')?1:0)+input.touch.x,dy=(input.keys.has('s')?1:0)-(input.keys.has('w')?1:0)+input.touch.y;let l=Math.max(1,Math.hypot(dx,dy));
  moveEntity(player,dx/l*player.speed*dt,dy/l*player.speed*dt);
  const touchMode=matchMedia('(pointer: coarse)').matches;if(touchMode){const target=enemies.filter(e=>!e.dead).sort((a,b)=>dist(a,player)-dist(b,player))[0];if(target)player.facing=Math.atan2(target.y-player.y,target.x-player.x)}else player.facing=Math.atan2(input.mouse.y-innerHeight/2,input.mouse.x-innerWidth/2);player.attackCd-=dt;player.mana=Math.min(player.maxMana,player.mana+7*dt);player.skillCd=player.skillCd.map(v=>Math.max(0,v-dt));
  if(input.mouse.down&&player.attackCd<=0)basicAttack();
  enemies.forEach(e=>updateEnemy(e,dt));
  projectiles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;enemies.forEach(e=>{if(!e.dead&&p.hit.indexOf(e)<0&&dist(p,e)<e.radius+7){damage(e,p.damage);p.hit.push(e);if(!p.pierce)p.life=0}})});projectiles=projectiles.filter(p=>p.life>0);
  particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.vx*=.96;p.vy*=.96});particles=particles.filter(p=>p.life>0);
  camera.x+=(player.x-innerWidth/2-camera.x)*.09;camera.y+=(player.y-innerHeight/2-camera.y)*.09;camera.x=Math.max(0,Math.min(WORLD.width-innerWidth,camera.x));camera.y=Math.max(0,Math.min(WORLD.height-innerHeight,camera.y));shake*=.88;
  updateUI();
}
function moveEntity(o,dx,dy){let nx=Math.max(o.radius,Math.min(WORLD.width-o.radius,o.x+dx)),ny=Math.max(o.radius,Math.min(WORLD.height-o.radius,o.y+dy));if(!collides(nx,o.y,o.radius))o.x=nx;if(!collides(o.x,ny,o.radius))o.y=ny}
function collides(x,y,r){return obstacles.some(([ox,oy,w,h])=>x+r>ox&&x-r<ox+w&&y+r>oy&&y-r<oy+h)}
function updateEnemy(e,dt){if(e.dead)return;e.hit-=dt;e.attackCd-=dt;const d=dist(e,player);if(d<440){const a=Math.atan2(player.y-e.y,player.x-e.x);if(d>e.radius+player.radius+5)moveEntity(e,Math.cos(a)*e.speed*dt,Math.sin(a)*e.speed*dt);else if(e.attackCd<=0){hurtPlayer(e.damage);e.attackCd=e.type==='boss'?1.2:1.5}}
  if(e.type==='boss'&&d<500&&e.attackCd<.1&&Math.random()<.018){for(let i=0;i<12;i++)particle(e.x,e.y,'#7d2638',120,1.2,i/12*Math.PI*2);if(d<150)hurtPlayer(12)}
}
function basicAttack(){player.attackCd=.32;const a=player.facing;projectiles.push({x:player.x+Math.cos(a)*25,y:player.y+Math.sin(a)*25,vx:Math.cos(a)*620,vy:Math.sin(a)*620,life:.8,damage:player.damage,hit:[],pierce:false,color:'#d9d0ae'});for(let i=0;i<5;i++)particle(player.x,player.y,'#c9b680',80,.3,a+(Math.random()-.5)*.5)}
function cast(i){if(!running||player.skillCd[i]>0||player.mana<skills[i].cost)return;player.mana-=skills[i].cost;player.skillCd[i]=skills[i].cooldown;const a=player.facing;
  if(i===0){projectiles.push({x:player.x,y:player.y,vx:Math.cos(a)*780,vy:Math.sin(a)*780,life:1.1,damage:player.damage*1.5,hit:[],pierce:true,color:'#e1d8bd'});}
  if(i===1){enemies.forEach(e=>{if(!e.dead&&dist(e,player)<125){damage(e,player.damage*1.8);player.hp=Math.min(player.maxHp,player.hp+5)}});burst(player.x,player.y,'#b62232',25);}
  if(i===2){enemies.forEach(e=>{const d=dist(e,player);if(!e.dead&&d<220){damage(e,player.damage*2.4);const a=Math.atan2(e.y-player.y,e.x-player.x);moveEntity(e,Math.cos(a)*60,Math.sin(a)*60)}});burst(player.x,player.y,'#8461b5',45);shake=10;}
}
function damage(e,n){if(Math.random()*100<player.crit)n*=2;e.hp-=n;e.hit=.12;floatText(e.x,e.y-30,`-${Math.round(n)}`);for(let i=0;i<6;i++)particle(e.x,e.y,e.color,90,.45);if(e.hp<=0)kill(e)}
function kill(e){e.dead=true;player.xp+=e.xp;burst(e.x,e.y,e.type==='boss'?'#a57845':'#641e27',18);if(Math.random()<.62||e.type==='boss')loot.push({x:e.x,y:e.y,type:itemTypes[Math.floor(Math.random()*itemTypes.length)],bob:Math.random()*6});if(e.type==='boss'){ui.questText.textContent='墓园守望者已被诛灭 · Demo 完成';toast('圣堂的诅咒暂时消散了');}levelUp()}
function hurtPlayer(n){n=Math.max(1,n-player.armor);player.hp-=n;shake=6;floatText(player.x,player.y-35,`-${n}`);if(player.hp<=0){running=false;ui.death.classList.remove('hidden')}}
function levelUp(){const need=player.level*100;if(player.xp>=need){player.xp-=need;player.level++;player.maxHp+=15;player.hp=player.maxHp;player.damage+=4;toast(`等级提升 · ${player.level}`)}}
function pickup(){const near=loot.find(x=>dist(x,player)<75);if(!near)return;player.inventory.push({...near.type,id:Date.now()+Math.random()});loot.splice(loot.indexOf(near),1);toast(`获得：${near.type.name}`);renderBag()}
function toggleBag(){ui.inventory.classList.toggle('open');renderBag()}
function renderBag(){ui.bag.innerHTML='';player.inventory.forEach(item=>{const el=document.createElement('div');el.className='item';el.innerHTML=`<b>${item.icon}</b><small>${item.name}<br>${item.stat} +${item.value}</small>`;el.onclick=()=>equip(item);ui.bag.append(el)});ui.gear.innerHTML=`<h3>已装备</h3><div class="slots">${Object.entries(player.gear).map(([k,v])=>`<div class="item ${v?'':'empty'}"><b>${v?.icon||'◇'}</b><small>${v?.name||k}</small></div>`).join('')}</div>`}
function equip(item){const old=player.gear[item.slot];if(old)player.inventory.push(old);player.gear[item.slot]=item;player.inventory.splice(player.inventory.indexOf(item),1);Object.assign(player,{maxHp:100+player.level*15-15,damage:18+(player.level-1)*4,armor:0,crit:0});Object.values(player.gear).filter(Boolean).forEach(x=>{if(x.stat==='生命')player.maxHp+=x.value;if(x.stat==='伤害')player.damage+=x.value;if(x.stat==='护甲')player.armor+=x.value;if(x.stat==='暴击')player.crit+=x.value});player.hp=Math.min(player.hp,player.maxHp);toast(`已装备：${item.name}`);renderBag()}
function updateUI(){ui.hpText.textContent=Math.ceil(player.hp);ui.manaText.textContent=Math.ceil(player.mana);ui.level.textContent=`等级 ${player.level}`;ui.xpFill.style.width=`${player.xp/(player.level*100)*100}%`;document.querySelectorAll('.skill').forEach((el,i)=>{el.querySelector('.cool').style.transform=`scaleY(${player.skillCd[i]/skills[i].cooldown})`;el.classList.toggle('disabled',player.mana<skills[i].cost)});const boss=enemies.find(e=>e.type==='boss'&&!e.dead);ui.bossbar.classList.toggle('hidden',!boss||dist(boss,player)>650);if(boss)ui.bossbar.querySelector('i').style.width=`${Math.max(0,boss.hp/boss.maxHp*100)}%`}

function draw(){const w=innerWidth,h=innerHeight;ctx.clearRect(0,0,w,h);ctx.save();ctx.translate(-camera.x+(Math.random()-.5)*shake,-camera.y+(Math.random()-.5)*shake);drawGround();drawProps();loot.forEach(drawLoot);enemies.filter(e=>!e.dead).sort((a,b)=>a.y-b.y).forEach(drawEnemy);drawPlayer();projectiles.forEach(p=>{ctx.fillStyle=p.color;ctx.shadowBlur=14;ctx.shadowColor=p.color;ctx.beginPath();ctx.arc(p.x,p.y,6,0,7);ctx.fill();ctx.shadowBlur=0});particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life*2);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3)});ctx.globalAlpha=1;ctx.restore();drawVignette();}
function drawGround(){ctx.fillStyle='#17191a';ctx.fillRect(0,0,WORLD.width,WORLD.height);ctx.strokeStyle='#242628';ctx.lineWidth=1;const s=86;for(let y=0;y<WORLD.height;y+=s/2){for(let x=0;x<WORLD.width;x+=s){const xx=x+(Math.floor(y/(s/2))%2)*s/2;ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx+s/2,y+s/2);ctx.lineTo(xx,y+s);ctx.lineTo(xx-s/2,y+s/2);ctx.closePath();ctx.stroke()}}ctx.fillStyle='#24211f';ctx.beginPath();ctx.ellipse(2290,1640,270,210,0,0,7);ctx.fill();ctx.strokeStyle='#725043';ctx.lineWidth=4;ctx.stroke();}
function drawProps(){obstacles.forEach(([x,y,w,h],i)=>{ctx.fillStyle='#26272a';ctx.fillRect(x,y,w,h);ctx.fillStyle='#343438';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+18,y-22);ctx.lineTo(x+w+18,y-22);ctx.lineTo(x+w,y);ctx.fill();ctx.strokeStyle='#111';for(let k=12;k<w;k+=38){ctx.beginPath();ctx.moveTo(x+k,y);ctx.lineTo(x+k,y+h);ctx.stroke()}if(i%2===0){ctx.fillStyle='#6d522e';ctx.fillRect(x+w/2-3,y-28,6,18);ctx.fillStyle='#b47334';ctx.beginPath();ctx.arc(x+w/2,y-32,5+Math.sin(time*6),0,7);ctx.fill()}});for(let i=0;i<24;i++){let x=(i*337)%WORLD.width,y=(i*191+170)%WORLD.height;ctx.fillStyle='#303033';ctx.fillRect(x,y,26,34);ctx.beginPath();ctx.arc(x+13,y,13,Math.PI,0);ctx.fill();ctx.strokeStyle='#47474a';ctx.beginPath();ctx.moveTo(x+13,y+7);ctx.lineTo(x+13,y+22);ctx.moveTo(x+7,y+14);ctx.lineTo(x+19,y+14);ctx.stroke()}}
function drawPlayer(){ctx.save();ctx.translate(player.x,player.y);ctx.rotate(player.facing+Math.PI/2);ctx.fillStyle='#171a20';ctx.beginPath();ctx.moveTo(0,-28);ctx.lineTo(22,27);ctx.lineTo(-22,27);ctx.fill();ctx.fillStyle='#9a8b72';ctx.fillRect(-10,-15,20,25);ctx.fillStyle='#1c1d22';ctx.beginPath();ctx.arc(0,-18,12,0,7);ctx.fill();ctx.strokeStyle='#c1aa76';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(8,-8);ctx.lineTo(14,-38);ctx.stroke();ctx.restore();shadow(player.x,player.y+25,22)}
function drawEnemy(e){shadow(e.x,e.y+e.radius,e.radius);ctx.save();ctx.translate(e.x,e.y);ctx.fillStyle=e.hit>0?'#e8d9c4':e.color;ctx.strokeStyle='#171316';ctx.lineWidth=4;if(e.type==='wraith'){ctx.globalAlpha=.75;ctx.beginPath();ctx.moveTo(0,-25);ctx.quadraticCurveTo(28,5,15,32);ctx.lineTo(0,23);ctx.lineTo(-17,34);ctx.quadraticCurveTo(-25,0,0,-25);ctx.fill()}else{ctx.beginPath();ctx.ellipse(0,3,e.radius,e.radius*1.3,0,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#131315';ctx.beginPath();ctx.arc(0,-e.radius*.8,e.radius*.6,0,7);ctx.fill();ctx.fillStyle=e.type==='boss'?'#e18b3c':'#c34c40';ctx.fillRect(-e.radius*.32,-e.radius,3,3);ctx.fillRect(e.radius*.2,-e.radius,3,3);if(e.type==='boss'){ctx.strokeStyle='#8c7450';ctx.beginPath();ctx.moveTo(-25,-24);ctx.lineTo(-38,-50);ctx.lineTo(-15,-35);ctx.moveTo(25,-24);ctx.lineTo(38,-50);ctx.lineTo(15,-35);ctx.stroke()}}ctx.restore();healthBar(e)}
function healthBar(e){if(e.hp===e.maxHp)return;ctx.fillStyle='#09090a';ctx.fillRect(e.x-25,e.y-e.radius-22,50,5);ctx.fillStyle=e.type==='boss'?'#ae2633':'#8b3b39';ctx.fillRect(e.x-25,e.y-e.radius-22,50*Math.max(0,e.hp/e.maxHp),5)}
function drawLoot(l){const bob=Math.sin(time*3+l.bob)*4;ctx.fillStyle='#b59654';ctx.shadowColor='#d0a85a';ctx.shadowBlur=16;ctx.beginPath();ctx.arc(l.x,l.y-8+bob,7,0,7);ctx.fill();ctx.shadowBlur=0;if(dist(l,player)<75){ctx.fillStyle='#d6c6a4';ctx.font='12px serif';ctx.textAlign='center';ctx.fillText(`[E] ${l.type.name}`,l.x,l.y-27+bob)}}
function shadow(x,y,r){ctx.fillStyle='#05050688';ctx.beginPath();ctx.ellipse(x,y,r,8,0,0,7);ctx.fill()}
function drawVignette(){const g=ctx.createRadialGradient(innerWidth/2,innerHeight/2,innerHeight*.2,innerWidth/2,innerHeight/2,innerWidth*.72);g.addColorStop(0,'transparent');g.addColorStop(.7,'#05060722');g.addColorStop(1,'#020304e8');ctx.fillStyle=g;ctx.fillRect(0,0,innerWidth,innerHeight);ctx.fillStyle='#7a885705';for(let i=0;i<30;i++)ctx.fillRect(Math.random()*innerWidth,Math.random()*innerHeight,1,1)}
function burst(x,y,c,n){for(let i=0;i<n;i++)particle(x,y,c,80+Math.random()*170,.4+Math.random()*.6,Math.random()*7)}
function particle(x,y,color,speed,life,a=Math.random()*7){particles.push({x,y,color,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life})}
function floatText(x,y,text){const d=document.createElement('div');d.className='toast-msg';d.style.position='fixed';d.style.left=`${x-camera.x}px`;d.style.top=`${y-camera.y}px`;d.style.color='#d9c4a0';d.textContent=text;ui.toast.append(d);setTimeout(()=>d.remove(),1000)}
function toast(text){const d=document.createElement('div');d.className='toast-msg';d.textContent=text;ui.toast.replaceChildren(d);setTimeout(()=>d.remove(),2400)}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}

draw();
