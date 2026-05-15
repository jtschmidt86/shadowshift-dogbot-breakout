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

const state = { level:1, health:100, maxHealth:100, energy:100, maxEnergy:100, coins:0, tokens:0, damage:20, unlocked:{strike:false,clone:false,dash:false}, objective:'', checkpoint:null, alive:true };
const keys = {}; let holdMouse=false, yaw=0, pitch=0.35;
const world = { group:new THREE.Group(), coins:[], enemies:[], hazards:[], portal:null, pickups:[], boss:null, projectiles:[], labels:[] };
scene.add(world.group);

const player = new THREE.Mesh(new THREE.BoxGeometry(1, 1.8, 1), new THREE.MeshStandardMaterial({ color:0x5ea0ff, emissive:0x210a44 }));
player.position.set(0,2,0); scene.add(player);
const shadowSlash = new THREE.Mesh(new THREE.TorusGeometry(1.2,0.1,8,24,2.4), new THREE.MeshBasicMaterial({ color:0x9d4cff })); shadowSlash.visible=false; scene.add(shadowSlash);
let vy=0;

function makeText(t){const d=document.createElement('div');d.className='floating-damage';d.textContent=t;document.body.appendChild(d);return {el:d,t:1,x:0,y:0};}
function clearLevel(){ while(world.group.children.length) world.group.remove(world.group.children[0]); Object.assign(world,{coins:[],enemies:[],hazards:[],portal:null,pickups:[],boss:null,projectiles:[],labels:[]}); }
function tile(x,z,w=4,d=4,c=0x2a3354,e=0x183862){const m=new THREE.Mesh(new THREE.BoxGeometry(w,1,d),new THREE.MeshStandardMaterial({color:c,emissive:e,emissiveIntensity:0.25}));m.position.set(x,0,z);world.group.add(m);return m;}
function coin(x,y,z){const m=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,0.15,16),new THREE.MeshStandardMaterial({color:0xffd94f,emissive:0x554400}));m.rotation.x=Math.PI/2;m.position.set(x,y,z);world.group.add(m);world.coins.push(m);}
function enemy(x,z,hp=40,type='bot'){const m=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.4,1.2),new THREE.MeshStandardMaterial({color:type==='pup'?0xff9955:0xff5b8f}));m.position.set(x,1,z);m.userData={hp,cooldown:0,type,home:new THREE.Vector3(x,1,z)};world.group.add(m);world.enemies.push(m);}
function portal(x,z){const m=new THREE.Mesh(new THREE.CylinderGeometry(1,1,2,20),new THREE.MeshBasicMaterial({color:0x57d9ff,transparent:true,opacity:0.8}));m.position.set(x,1.2,z);world.group.add(m);world.portal=m;}
function hudUpdate(){hud.Level.textContent=state.level;hud.Health.textContent=Math.max(0,Math.floor(state.health));hud.Energy.textContent=Math.floor(state.energy);hud.Coins.textContent=state.coins;hud.Tokens.textContent=state.tokens;hud.Objective.textContent=state.objective;hud.Checkpoint.textContent=state.checkpoint?`L${state.level}`:'None';}

function buildLevel(n){clearLevel(); player.position.set(0,2,0); state.checkpoint=new THREE.Vector3(0,2,0);
  for(let i=-5;i<=5;i++) for(let j=-5;j<=5;j++) if((i+j)%2===0) tile(i*4,j*4,4,4,0x222f55,0x12213f);
  if(n===1){ state.objective='Collect 10 coins then reach portal. Unlock: Shadow Strike'; for(let i=0;i<18;i++) coin((i%6-3)*4,1.4,Math.floor(i/6)*6-8); portal(18,0); state.unlocked.strike=true; }
  if(n===2){ state.objective='Defeat 5 Robo-Pups + collect 15 coins, then portal'; for(let i=0;i<22;i++) coin((i%7-3)*4,1.4,Math.floor(i/7)*8-8); for(let i=0;i<5;i++) enemy(-10+i*5,8,'', 'pup'); portal(18,12); }
  if(n===3){ state.objective='Collect 3 Shadow Tokens, defeat 3 drones, avoid glitch traps. Unlock: Shadow Clone'; for(let i=0;i<16;i++) coin(-16+(i%8)*4,1.4,-8+Math.floor(i/8)*10); for(let i=0;i<3;i++) {const p=new THREE.Mesh(new THREE.OctahedronGeometry(0.6),new THREE.MeshBasicMaterial({color:0xab5cff}));p.position.set(-12+i*8,1.5,12);world.group.add(p);world.pickups.push({mesh:p,type:'token'});} for(let i=0;i<3;i++) enemy(8+i*5,-12,45); state.unlocked.clone=true; portal(18,-12); }
  if(n===4){ state.objective='Cross sky bridges, collect 5 orbs, reach portal'; for(let i=0;i<10;i++) tile(i*5-20,6+i*4,4,4,0x3a2f66,0x1c3a64), coin(i*5-20,2.2,6+i*4); for(let i=0;i<5;i++){const o=new THREE.Mesh(new THREE.SphereGeometry(0.5),new THREE.MeshBasicMaterial({color:0x63f9ff}));o.position.set(-20+i*10,3.5,10+i*6);world.group.add(o);world.pickups.push({mesh:o,type:'orb'});} portal(28,44); }
  if(n===5){ state.objective='Defeat 6 Security Bots, find Anti-Fur Cloak, reach portal'; for(let i=0;i<28;i++) coin((i%7-3)*5,1.4,Math.floor(i/7)*6-8); for(let i=0;i<6;i++) enemy(-14+i*5,10,50); const c=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0x88ffef}));c.position.set(16,1.5,-16);world.group.add(c);world.pickups.push({mesh:c,type:'cloak'}); portal(20,20); }
  if(n===6){ state.objective='Break barriers, defeat 5 Junk Bots, get Mind Magnet'; for(let i=0;i<5;i++) enemy(-10+i*5,-8,55); for(let i=0;i<14;i++) coin(-18+(i%7)*6,1.4,18+Math.floor(i/7)*6); const m=new THREE.Mesh(new THREE.BoxGeometry(1.4,1.4,1.4),new THREE.MeshBasicMaterial({color:0xb2f3ff}));m.position.set(18,1.8,12);world.group.add(m);world.pickups.push({mesh:m,type:'magnet'}); portal(22,-12); }
  if(n===7){ state.objective='Avoid electric floors, defeat 6 bots, recharge + battery. Unlock: Dash'; for(let i=0;i<6;i++) enemy(-15+i*6,14,60); for(let i=0;i<20;i++) coin(-20+(i%10)*4,1.4,-12+Math.floor(i/10)*20); const b=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,1.5),new THREE.MeshBasicMaterial({color:0xfff26d}));b.position.set(0,1.7,20);world.group.add(b);world.pickups.push({mesh:b,type:'battery'}); state.unlocked.dash=true; portal(20,20); }
  if(n===8){ state.objective='Defeat DogBot 9000: break tail, expose and overload core'; const b=new THREE.Mesh(new THREE.BoxGeometry(6,5,8),new THREE.MeshStandardMaterial({color:0x8a8a9f,emissive:0x330000}));b.position.set(0,3,-20); b.userData={hp:220,phase:1,cooldown:2}; world.group.add(b); world.boss=b; for(let i=0;i<6;i++) coin(-10+i*4,1.4,10); }
  hudUpdate();
}
function damagePlayer(d){ state.health-=d; player.material.emissive.setHex(0xff2222); setTimeout(()=>player.material.emissive.setHex(0x210a44),120); const l=makeText(`-${d} HP`); l.x=innerWidth/2; l.y=innerHeight/2; world.labels.push(l); if(state.health<=0){state.alive=false; gameOverEl.classList.remove('hidden');}}
function attack(){ if(!state.unlocked.strike) return; shadowSlash.visible=true; shadowSlash.position.copy(player.position); setTimeout(()=>shadowSlash.visible=false,120); world.enemies.forEach(e=>{if(e.position.distanceTo(player.position)<3){e.userData.hp-=state.damage;e.material.color.setHex(0xffffff); setTimeout(()=>e.material.color.setHex(0xff5b8f),80); if(e.userData.hp<=0){world.group.remove(e); state.coins+=2;}}}); if(world.boss && world.boss.position.distanceTo(player.position)<8){world.boss.userData.hp-=state.damage;world.boss.material.emissive.setHex(0xaa1111);} }

function animate(t=0){ requestAnimationFrame(animate); const dt=0.016; if(state.alive){
  const sp=0.18*(keys.ShiftLeft&&state.unlocked.dash?2.2:1); const dir=new THREE.Vector3((keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),0,(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0)); if(dir.length()) dir.normalize().multiplyScalar(sp).applyAxisAngle(new THREE.Vector3(0,1,0),yaw), player.position.add(dir);
  if((keys.Space)&&player.position.y<=2.01) vy=0.23; vy-=0.012; player.position.y=Math.max(2,player.position.y+vy);
  camera.position.lerp(new THREE.Vector3(player.position.x+Math.sin(yaw)*10, player.position.y+6+pitch*2, player.position.z+Math.cos(yaw)*10),0.15); camera.lookAt(player.position.x,player.position.y+1,player.position.z);
  world.coins=world.coins.filter(c=>{c.rotation.z+=0.08;c.position.y+=Math.sin(t*0.003+c.position.x)*0.005;if(c.position.distanceTo(player.position)<1.2){world.group.remove(c);state.coins++;return false;} return true;});
  world.enemies.forEach(e=>{ const dist=e.position.distanceTo(player.position); if(dist<16){ const wob=Math.sin(t*0.01)*0.02; e.position.y=1+wob; if(dist<2.2&&e.userData.cooldown<=0){damagePlayer(10);e.userData.cooldown=1;} e.userData.cooldown=Math.max(0,e.userData.cooldown-dt);} });
  world.pickups = world.pickups.filter(p=>{p.mesh.rotation.y+=0.04;if(p.mesh.position.distanceTo(player.position)<1.5){ if(p.type==='token') state.tokens++; if(p.type==='orb') state.energy=Math.min(state.maxEnergy,state.energy+20); world.group.remove(p.mesh); return false;} return true;});
  if(world.portal && world.portal.position.distanceTo(player.position)<2.2){ if(state.level<8){shop.classList.remove('hidden'); state.alive=false;} else {victoryEl.classList.remove('hidden'); state.alive=false;} }
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
