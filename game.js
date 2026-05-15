import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';

const canvas = document.getElementById('gameCanvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090c1a);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

scene.add(new THREE.HemisphereLight(0x80c4ff, 0x10121f, 1.2));
const dir = new THREE.DirectionalLight(0x8fd3ff, 0.5); dir.position.set(5, 10, 7); scene.add(dir);

const hud = Object.fromEntries(['Level','Health','Energy','Coins','Tokens','Objective','Checkpoint'].map(k=>[k,document.getElementById('hud'+k)]));
const shop = document.getElementById('shop');
const gameOverEl = document.getElementById('gameOver');
const victoryEl = document.getElementById('victory');

const state = { level:1, health:100, maxHealth:100, energy:100, maxEnergy:100, coins:0, tokens:0, damage:20, unlocked:{strike:false,clone:false,dash:false}, objective:'', checkpoint:null, alive:true, levelCoinsStart:0, objectiveComplete:false, hasCloak:false, hasMagnet:false, hasBattery:false };
const keys = {}; let holdMouse=false, yaw=0, pitch=0.35;
const world = { group:new THREE.Group(), coins:[], enemies:[], hazards:[], portal:null, pickups:[], boss:null, projectiles:[], labels:[] };
scene.add(world.group);

const hero = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45,0.9,8,12), new THREE.MeshStandardMaterial({ color:0x4f84ff, emissive:0x1d0f50, roughness:0.5 }));
const hood = new THREE.Mesh(new THREE.SphereGeometry(0.42,16,16), new THREE.MeshStandardMaterial({ color:0x1c2747, emissive:0x120927 }));
hood.position.y = 0.95;
const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.13,0.08), new THREE.MeshBasicMaterial({color:0x7be6ff}));
visor.position.set(0,0.98,0.38);
hero.add(body, hood, visor);
const player = hero;
player.position.set(0,2,0); scene.add(player);
const shadowSlash = new THREE.Mesh(new THREE.TorusGeometry(1.2,0.1,8,24,2.4), new THREE.MeshBasicMaterial({ color:0x9d4cff })); shadowSlash.visible=false; scene.add(shadowSlash);
let vy=0;

function makeText(t){const d=document.createElement('div');d.className='floating-damage';d.textContent=t;document.body.appendChild(d);return {el:d,t:1,x:0,y:0};}
function clearLevel(){ while(world.group.children.length) world.group.remove(world.group.children[0]); Object.assign(world,{coins:[],enemies:[],hazards:[],portal:null,pickups:[],boss:null,projectiles:[],labels:[]}); }
function tile(x,z,w=4,d=4,c=0x2a3354,e=0x183862){const m=new THREE.Mesh(new THREE.BoxGeometry(w,1,d),new THREE.MeshStandardMaterial({color:c,emissive:e,emissiveIntensity:0.25}));m.position.set(x,0,z);world.group.add(m);return m;}
function coin(x,y,z){const m=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,0.15,16),new THREE.MeshStandardMaterial({color:0xffd94f,emissive:0x554400}));m.rotation.x=Math.PI/2;m.position.set(x,y,z);world.group.add(m);world.coins.push(m);}
function enemy(x,z,hp=40,type='bot'){const g=new THREE.Group(); const m=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.4,1.2),new THREE.MeshStandardMaterial({color:type==='pup'?0xff9955:0xff5b8f})); m.position.y=1; g.add(m); const eyeMat=new THREE.MeshBasicMaterial({color:0xff3344}); const e1=new THREE.Mesh(new THREE.SphereGeometry(0.1,8,8),eyeMat); const e2=e1.clone(); e1.position.set(-0.2,1.15,0.62); e2.position.set(0.2,1.15,0.62); g.add(e1,e2); g.position.set(x,0,z); g.userData={hp,cooldown:0,type,home:new THREE.Vector3(x,0,z),dead:false,core:m}; world.group.add(g); world.enemies.push(g);}
function pickup(x,y,z,type,color){const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(0.45),new THREE.MeshBasicMaterial({color})); mesh.position.set(x,y,z); world.group.add(mesh); world.pickups.push({mesh,type});}
function hole(x,z,r=1.2){
  const pit = new THREE.Group();
  const glow = new THREE.Mesh(new THREE.RingGeometry(r*0.98,r*1.24,4,1),new THREE.MeshBasicMaterial({color:0xaa335f,transparent:true,opacity:0.75,side:THREE.DoubleSide}));
  glow.rotation.x=-Math.PI/2; glow.position.y=0.53; pit.add(glow);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(r*1.8,9,r*1.8),new THREE.MeshBasicMaterial({color:0x05050d}));
  shaft.position.y=-4.1; pit.add(shaft);
  const abyss = new THREE.Mesh(new THREE.PlaneGeometry(r*1.7,r*1.7),new THREE.MeshBasicMaterial({color:0x13001f,transparent:true,opacity:0.9,side:THREE.DoubleSide}));
  abyss.rotation.x=-Math.PI/2; abyss.position.y=-8.52; pit.add(abyss);
  pit.position.set(x,0,z); world.group.add(pit); world.hazards.push({mesh:pit,type:'hole',radius:r});
}
function portal(x,z){const m=new THREE.Mesh(new THREE.CylinderGeometry(1,1,2,20),new THREE.MeshBasicMaterial({color:0x57d9ff,transparent:true,opacity:0.8}));m.position.set(x,1.2,z);world.group.add(m);world.portal=m;}
function hudUpdate(){hud.Level.textContent=state.level;hud.Health.textContent=Math.max(0,Math.floor(state.health));hud.Energy.textContent=Math.floor(state.energy);hud.Coins.textContent=state.coins;hud.Tokens.textContent=state.tokens;hud.Objective.textContent=state.objective;hud.Checkpoint.textContent=state.checkpoint?`L${state.level}`:'None';}

function buildLevel(n){clearLevel(); player.position.set(0,2,0); state.checkpoint=new THREE.Vector3(0,2,0); state.levelCoinsStart=state.coins; state.objectiveComplete=false; state.hasCloak=false; state.hasMagnet=false; state.hasBattery=false;
  for(let i=-5;i<=5;i++) for(let j=-5;j<=5;j++) if((i+j)%2===0) tile(i*4,j*4,4,4,0x222f55,0x12213f);
  if(n===1){ state.objective='Collect 10 coins then reach portal. Unlock: Shadow Strike'; for(let i=0;i<18;i++) coin((i%6-3)*4,1.4,Math.floor(i/6)*6-8); portal(18,0); state.unlocked.strike=true; }
  if(n===2){ state.objective='Defeat 5 Robo-Pups + collect 15 coins, then portal'; for(let i=0;i<22;i++) coin((i%7-3)*4,1.4,Math.floor(i/7)*8-8); for(let i=0;i<5;i++) enemy(-10+i*5,8,'', 'pup'); portal(18,12); }
  if(n===3){ state.objective='Collect 3 Shadow Tokens, defeat 3 drones, avoid glitch traps. Unlock: Shadow Clone'; for(let i=0;i<16;i++) coin(-16+(i%8)*4,1.4,-8+Math.floor(i/8)*10); for(let i=0;i<3;i++) {const p=new THREE.Mesh(new THREE.OctahedronGeometry(0.6),new THREE.MeshBasicMaterial({color:0xab5cff}));p.position.set(-12+i*8,1.5,12);world.group.add(p);world.pickups.push({mesh:p,type:'token'});} for(let i=0;i<3;i++) enemy(8+i*5,-12,45); state.unlocked.clone=true; portal(18,-12); }
  if(n===4){ state.objective='Cross sky bridges, collect 5 orbs, reach portal'; for(let i=0;i<10;i++) tile(i*5-20,6+i*4,4,4,0x3a2f66,0x1c3a64), coin(i*5-20,2.2,6+i*4); for(let i=0;i<5;i++){const o=new THREE.Mesh(new THREE.SphereGeometry(0.5),new THREE.MeshBasicMaterial({color:0x63f9ff}));o.position.set(-20+i*10,3.5,10+i*6);world.group.add(o);world.pickups.push({mesh:o,type:'orb'});} for(let i=0;i<6;i++) tile(-12+i*4,-14,3.5,3.5,0x334366,0x173455); portal(28,44); }
  if(n===5){ state.objective='Defeat 6 Security Bots, find Anti-Fur Cloak, reach portal'; for(let i=0;i<28;i++) coin((i%7-3)*5,1.4,Math.floor(i/7)*6-8); for(let i=0;i<6;i++) enemy(-14+i*5,10,50); const c=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0x88ffef}));c.position.set(16,1.5,-16);world.group.add(c);world.pickups.push({mesh:c,type:'cloak'}); hole(8,8,1.4); hole(-10,-6,1.2); portal(20,20); }
  if(n===6){ state.objective='Break barriers, defeat 5 Junk Bots, get Mind Magnet'; for(let i=0;i<5;i++) enemy(-10+i*5,-8,55); for(let i=0;i<14;i++) coin(-18+(i%7)*6,1.4,18+Math.floor(i/7)*6); const m=new THREE.Mesh(new THREE.BoxGeometry(1.4,1.4,1.4),new THREE.MeshBasicMaterial({color:0xb2f3ff}));m.position.set(18,1.8,12);world.group.add(m);world.pickups.push({mesh:m,type:'magnet'}); portal(22,-12); }
  if(n===7){ state.objective='Avoid electric floors, defeat 6 bots, recharge + battery. Unlock: Dash'; for(let i=0;i<6;i++) enemy(-15+i*6,14,60); for(let i=0;i<20;i++) coin(-20+(i%10)*4,1.4,-12+Math.floor(i/10)*20); const b=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,1.5),new THREE.MeshBasicMaterial({color:0xfff26d}));b.position.set(0,1.7,20);world.group.add(b);world.pickups.push({mesh:b,type:'battery'}); pickup(-18,1.5,16,'health',0xff5f7d); pickup(18,1.5,-16,'energy',0x59e8ff); state.unlocked.dash=true; portal(20,20); }
  if(n===8){ state.objective='Defeat DogBot 9000: break tail, expose and overload core'; const b=new THREE.Mesh(new THREE.BoxGeometry(6,5,8),new THREE.MeshStandardMaterial({color:0x8a8a9f,emissive:0x330000}));b.position.set(0,3,-20); b.userData={hp:220,phase:1,cooldown:2}; world.group.add(b); world.boss=b; for(let i=0;i<6;i++) coin(-10+i*4,1.4,10); }
  hudUpdate();
}
function damagePlayer(d){ state.health-=d; body.material.emissive.setHex(0xff2222); setTimeout(()=>body.material.emissive.setHex(0x1d0f50),120); const l=makeText(`-${d} HP`); l.x=innerWidth/2; l.y=innerHeight/2; world.labels.push(l); if(state.health<=0){state.alive=false; gameOverEl.classList.remove('hidden');}}
function objectiveDone(){
  const defeated = world.enemies.filter(e=>!e.userData.dead).length===0;
  const lvlCoins = state.coins - state.levelCoinsStart;
  if(state.level===1) return lvlCoins>=10;
  if(state.level===2) return defeated && lvlCoins>=15;
  if(state.level===3) return state.tokens>=3 && defeated;
  if(state.level===4) return world.pickups.filter(p=>p.type==='orb').length===0;
  if(state.level===5) return state.hasCloak && defeated;
  if(state.level===6) return state.hasMagnet && defeated;
  if(state.level===7) return state.hasBattery && defeated;
  return true;
}
function attack(){ if(!state.unlocked.strike) return; shadowSlash.visible=true; shadowSlash.position.copy(player.position); setTimeout(()=>shadowSlash.visible=false,120); world.enemies.forEach(e=>{if(e.userData.dead) return; if(e.position.distanceTo(player.position)<3){e.userData.hp-=state.damage;e.userData.core.material.color.setHex(0xffffff); setTimeout(()=>e.userData.core.material.color.setHex(e.userData.type==='pup'?0xff9955:0xff5b8f),80); if(e.userData.hp<=0){e.userData.dead=true; world.group.remove(e); state.coins+=2;}}}); if(world.boss && world.boss.position.distanceTo(player.position)<8){world.boss.userData.hp-=state.damage;world.boss.material.emissive.setHex(0xaa1111);} }

function animate(t=0){ requestAnimationFrame(animate); const dt=0.016; if(state.alive){
  const sp=0.18*(keys.ShiftLeft&&state.unlocked.dash?2.2:1); const dir=new THREE.Vector3((keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),0,(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0)); if(dir.length()) dir.normalize().multiplyScalar(sp).applyAxisAngle(new THREE.Vector3(0,1,0),yaw), player.position.add(dir);
  const holeHit = world.hazards.find(h=>h.type==='hole' && new THREE.Vector2(player.position.x-h.mesh.position.x, player.position.z-h.mesh.position.z).length()<h.radius*0.9);
  const onSolidGround = !holeHit;
  if((keys.Space)&&onSolidGround&&player.position.y<=2.01) vy=0.23; vy-=0.012; player.position.y=Math.max(onSolidGround?2:-100,player.position.y+vy);
  camera.position.lerp(new THREE.Vector3(player.position.x+Math.sin(yaw)*10, player.position.y+6+pitch*2, player.position.z+Math.cos(yaw)*10),0.15); camera.lookAt(player.position.x,player.position.y+1,player.position.z);
  world.coins=world.coins.filter(c=>{c.rotation.z+=0.08;c.position.y+=Math.sin(t*0.003+c.position.x)*0.005;if(c.position.distanceTo(player.position)<1.2){world.group.remove(c);state.coins++;return false;} return true;});
  world.enemies.forEach(e=>{ if(e.userData.dead) return; const dist=e.position.distanceTo(player.position); if(dist<11){ e.position.lerp(new THREE.Vector3(player.position.x,0,player.position.z),0.015); } else { e.position.lerp(e.userData.home,0.02);} if(dist<2.2&&e.userData.cooldown<=0){damagePlayer(10);e.userData.cooldown=1;} e.userData.cooldown=Math.max(0,e.userData.cooldown-dt);});
  world.pickups = world.pickups.filter(p=>{p.mesh.rotation.y+=0.04;if(p.mesh.position.distanceTo(player.position)<1.5){ if(p.type==='token') state.tokens++; if(p.type==='orb') state.energy=Math.min(state.maxEnergy,state.energy+20); if(p.type==='health') state.health=Math.min(state.maxHealth,state.health+35); if(p.type==='energy') state.energy=Math.min(state.maxEnergy,state.energy+40); if(p.type==='cloak') state.hasCloak=true; if(p.type==='magnet') state.hasMagnet=true; if(p.type==='battery') state.hasBattery=true; world.group.remove(p.mesh); return false;} return true;});
  if(player.position.y<-8){player.position.copy(state.checkpoint); vy=0; damagePlayer(15);}
  state.objectiveComplete = objectiveDone();
  if(world.portal){world.portal.material.color.setHex(state.objectiveComplete?0x57d9ff:0xff4f7f); if(world.portal.position.distanceTo(player.position)<2.2 && state.objectiveComplete){ if(state.level<8){shop.classList.remove('hidden'); state.alive=false;} else {victoryEl.classList.remove('hidden'); state.alive=false;} }}
  if(world.boss){const b=world.boss;b.userData.cooldown-=dt; if(b.userData.cooldown<0){const p=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,2),new THREE.MeshBasicMaterial({color:0xff5566}));p.position.copy(b.position);p.userData={v:player.position.clone().sub(b.position).normalize().multiplyScalar(0.4)};world.group.add(p);world.projectiles.push(p);b.userData.cooldown=1.4;} if(b.userData.hp<=0){world.portal??portal(0,20); world.group.remove(b); world.boss=null; }}
  world.projectiles=world.projectiles.filter(p=>{p.position.add(p.userData.v); if(p.position.distanceTo(player.position)<1){damagePlayer(12); world.group.remove(p); return false;} if(p.position.length()>200){world.group.remove(p); return false;} return true;});
 }
 world.labels=world.labels.filter(l=>{l.t-=0.02; l.y-=0.8; l.el.style.left=l.x+'px'; l.el.style.top=l.y+'px'; l.el.style.opacity=l.t; if(l.t<=0){l.el.remove(); return false;} return true;});
 hudUpdate(); renderer.render(scene,camera);
}

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
addEventListener('keydown',e=>{keys[e.code]=true; if(e.code==='KeyF') attack();}); addEventListener('keyup',e=>keys[e.code]=false);
canvas.addEventListener('mousedown',e=>{if(e.button===0) holdMouse=true;}); addEventListener('mouseup',()=>holdMouse=false);
addEventListener('mousemove',e=>{if(!holdMouse) return; yaw-=e.movementX*0.004; pitch=Math.max(-0.4,Math.min(0.8,pitch-e.movementY*0.003));});
document.getElementById('continueBtn').onclick=()=>{shop.classList.add('hidden'); state.level++; state.alive=true; buildLevel(state.level);};
document.querySelectorAll('#shop button[data-upgrade]').forEach(b=>b.onclick=()=>{const t=b.dataset.upgrade,c=t==='damage'?25:20;if(state.coins<c)return;state.coins-=c;if(t==='health'){state.maxHealth+=20;state.health+=20;}if(t==='energy'){state.maxEnergy+=20;state.energy+=20;}if(t==='damage')state.damage+=5;});
document.getElementById('restartBtn').onclick=document.getElementById('playAgainBtn').onclick=()=>location.reload();

buildLevel(1); animate();
