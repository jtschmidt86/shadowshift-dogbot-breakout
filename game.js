import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';

const canvas = document.getElementById('gameCanvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090c1a);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 600);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

scene.add(new THREE.HemisphereLight(0x80c4ff, 0x10121f, 1.15));
const dir = new THREE.DirectionalLight(0x8fd3ff, 0.45);
dir.position.set(8, 14, 8);
scene.add(dir);

const hud = Object.fromEntries(['Level', 'Health', 'Energy', 'Coins', 'Tokens', 'Objective', 'Checkpoint'].map(k => [k, document.getElementById('hud' + k)]));
const shop = document.getElementById('shop');
const gameOverEl = document.getElementById('gameOver');
const victoryEl = document.getElementById('victory');

const state = {
  level: 1,
  health: 100,
  maxHealth: 100,
  energy: 100,
  maxEnergy: 100,
  coins: 0,
  tokens: 0,
  damage: 20,
  unlocked: { strike: false, clone: false, dash: false },
  objective: '',
  checkpoint: null,
  alive: true,
  levelStats: { coins: 0, kills: 0, tokens: 0, orbs: 0, battery: false, cloak: false, magnet: false, recharge: false }
};

const keys = {};
let holdMouse = false;
let yaw = 0;
let pitch = 0.35;
let vy = 0;
let portalWarnCooldown = 0;

const world = {
  group: new THREE.Group(),
  coins: [], enemies: [], pickups: [], hazards: [], portals: null, projectiles: [], labels: [], checkpoints: [], platforms: []
};
scene.add(world.group);

function makeHero() {
  const g = new THREE.Group();
  const matBody = new THREE.MeshStandardMaterial({ color: 0x4f88ff, emissive: 0x121f55 });
  const matWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x111111 });
  const matPurple = new THREE.MeshStandardMaterial({ color: 0x8b57ff, emissive: 0x290a5c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.7), matBody); body.position.y = 1.8;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), matWhite); head.position.y = 2.75;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.18, 0.08), new THREE.MeshBasicMaterial({ color: 0x8f5bff })); visor.position.set(0, 2.78, 0.38);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.95, 0.28), matWhite); armL.position.set(-0.68, 1.8, 0);
  const armR = armL.clone(); armR.position.x = 0.68;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.95, 0.35), matBody); legL.position.set(-0.25, 0.95, 0);
  const legR = legL.clone(); legR.position.x = 0.25;
  const cape = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.08), new THREE.MeshStandardMaterial({ color: 0x6f4bff, emissive: 0x310e74, transparent: true, opacity: 0.88 }));
  cape.position.set(0, 1.85, -0.42);
  g.add(body, head, visor, armL, armR, legL, legR, cape);
  const tag = document.createElement('div');
  tag.className = 'floating-damage'; tag.style.color = '#9eb7ff'; tag.style.textShadow = '0 0 8px #5a6dff'; tag.textContent = 'ShadowShift';
  document.body.appendChild(tag);
  g.userData.nameTag = tag;
  return g;
}

const player = makeHero();
player.position.set(0, 1.5, 0);
scene.add(player);

const shadowSlash = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 20, 2.7), new THREE.MeshBasicMaterial({ color: 0xa14dff }));
shadowSlash.visible = false;
scene.add(shadowSlash);

function damageLabel(text, x, y, c = '#ff6b6b') {
  const el = document.createElement('div');
  el.className = 'floating-damage';
  el.textContent = text;
  el.style.color = c;
  document.body.appendChild(el);
  world.labels.push({ el, x, y, t: 1.0 });
}

function hudUpdate() {
  hud.Level.textContent = state.level;
  hud.Health.textContent = Math.max(0, Math.floor(state.health));
  hud.Energy.textContent = Math.floor(state.energy);
  hud.Coins.textContent = state.coins;
  hud.Tokens.textContent = state.tokens;
  hud.Objective.textContent = state.objective;
  hud.Checkpoint.textContent = state.checkpoint ? `(${state.checkpoint.x.toFixed(0)}, ${state.checkpoint.z.toFixed(0)})` : 'None';
}

function clearLevel() {
  while (world.group.children.length) world.group.remove(world.group.children[0]);
  for (const l of world.labels) l.el.remove();
  Object.assign(world, { coins: [], enemies: [], pickups: [], hazards: [], portals: null, projectiles: [], labels: [], checkpoints: [], platforms: [] });
}

function addTile(x, y, z, w = 4, h = 1, d = 4, safe = true) {
  const c = safe ? 0x263762 : 0x4f2c7a;
  const e = safe ? 0x14233d : 0x321343;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: 0.24 }));
  m.position.set(x, y, z); world.group.add(m); world.platforms.push(m); return m;
}

function addCoin(x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 12), new THREE.MeshStandardMaterial({ color: 0xffd94f, emissive: 0x5e4200 }));
  m.rotation.x = Math.PI / 2; m.position.set(x, y, z); world.group.add(m); world.coins.push(m);
}

function enemyEyes(type) {
  const color = type === 'pup' ? 0xff4f4f : (type === 'drone' ? 0xb25cff : 0xff4f6d);
  const mat = new THREE.MeshBasicMaterial({ color });
  const l = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.04), mat);
  const r = l.clone();
  l.position.set(-0.18, 0.2, 0.62); r.position.set(0.18, 0.2, 0.62);
  return [l, r];
}

function addEnemy(x, z, opts = {}) {
  const { hp = 45, type = 'bot', range = 14 } = opts;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: type === 'pup' ? 0xff9a55 : type === 'drone' ? 0x995dff : 0xff5d8e }));
  body.position.set(x, 1, z);
  enemyEyes(type).forEach(e => body.add(e));
  body.userData = {
    hp, maxHp: hp, type, home: new THREE.Vector3(x, 1, z), active: true,
    detectRange: range, chaseRange: range + 6, attackRange: 1.8, cooldown: 0, chasing: false, speed: type === 'pup' ? 0.07 : 0.055
  };
  world.group.add(body); world.enemies.push(body); return body;
}

function addPortal(x, z) {
  const g = new THREE.Group();
  const gate = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 16), new THREE.MeshBasicMaterial({ color: 0x6a78aa, transparent: true, opacity: 0.55 }));
  gate.position.y = 1.2;
  g.add(gate); g.position.set(x, 0, z);
  g.userData = { locked: true, gate };
  world.group.add(g); world.portals = g;
}

function addPickup(x, y, z, type) {
  const color = type === 'health' ? 0x48ff83 : type === 'energy' ? 0x51a8ff : 0xfff26d;
  const geo = type === 'health' || type === 'energy' ? new THREE.BoxGeometry(0.8, 0.8, 0.8) : new THREE.SphereGeometry(0.5, 10, 10);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
  m.position.set(x, y, z);
  world.group.add(m);
  world.pickups.push({ mesh: m, type, active: true });
}

function addHazard(x, z, w = 4, d = 4, type = 'electric') {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), new THREE.MeshBasicMaterial({ color: type === 'electric' ? 0x58a3ff : 0xaf51ff, transparent: true, opacity: 0.8 }));
  m.position.set(x, 0.15, z); world.group.add(m);
  world.hazards.push({ mesh: m, type, damage: type === 'electric' ? 12 : 10, cooldown: 0 });
}

function setCheckpoint(x, y, z) {
  state.checkpoint = new THREE.Vector3(x, y, z);
  world.checkpoints.push(state.checkpoint.clone());
}

function resetLevelStats() {
  state.levelStats = { coins: 0, kills: 0, tokens: 0, orbs: 0, battery: false, cloak: false, magnet: false, recharge: false };
}

function buildLevel(n) {
  clearLevel(); resetLevelStats();
  const baseY = 0;
  player.position.set(0, 1.5, 0); vy = 0;
  setCheckpoint(0, 1.5, 0);

  // Default sparse floor with holes (missing tiles)
  for (let i = -4; i <= 6; i++) {
    for (let j = -4; j <= 6; j++) {
      if ((i + j) % 3 !== 0) addTile(i * 4, baseY, j * 4);
    }
  }

  if (n === 1) {
    state.objective = 'Collect 10 coins then reach portal';
    state.unlocked.strike = true;
    // beginner raised path + coin guides
    addTile(8, 1.2, 0); addTile(12, 1.2, 0); addTile(16, 0, 0); addTile(20, 1.6, 0);
    addTile(24, 1.6, 0); addTile(28, 0, 0);
    for (let i = 0; i < 12; i++) addCoin(-8 + i * 3, 1.4 + (i > 4 && i < 9 ? 0.7 : 0), -2 + (i % 2));
    for (let i = 0; i < 6; i++) addCoin(8 + i * 4, 2.2, 0);
    addPickup(4, 1.5, 6, 'health'); addPickup(14, 2.4, 0, 'energy');
    addPortal(32, 0);
  }
  if (n === 2) {
    state.objective = 'Defeat 5 Robo-Pups and collect 15 coins';
    for (let i = 0; i < 22; i++) addCoin(-12 + (i % 8) * 4, 1.4, -8 + Math.floor(i / 8) * 8);
    for (let i = 0; i < 5; i++) addEnemy(-14 + i * 7, 12, { type: 'pup', hp: 45, range: 13 });
    addPickup(0, 1.5, 10, 'health'); addPickup(10, 1.5, -6, 'energy');
    addPortal(26, 16);
  }
  if (n === 3) {
    state.objective = 'Collect 3 Shadow Tokens and defeat 3 Glitch Drones';
    for (let i = 0; i < 16; i++) addCoin(-16 + (i % 8) * 4, 1.4, -6 + Math.floor(i / 8) * 10);
    for (let i = 0; i < 3; i++) addEnemy(6 + i * 6, -12, { type: 'drone', hp: 55, range: 15 });
    for (let i = 0; i < 3; i++) addPickup(-10 + i * 8, 1.8, 14, 'token');
    addHazard(-4, 2, 4, 4, 'glitch'); addHazard(12, -2, 4, 4, 'glitch');
    state.unlocked.clone = true; addPortal(20, -12);
  }
  if (n === 4) {
    state.objective = 'Collect 5 Energy Orbs and reach portal';
    for (let i = 0; i < 9; i++) { addTile(-16 + i * 5, i * 1.2, 8 + i * 4, 4, 1, 4); addCoin(-16 + i * 5, 2 + i * 1.2, 8 + i * 4); }
    for (let i = 0; i < 5; i++) addPickup(-14 + i * 9, 2.4 + i, 12 + i * 6, 'orb');
    addPickup(2, 2.5, 18, 'health'); addPortal(30, 44);
  }
  if (n === 5) {
    state.objective = 'Defeat 6 Security Bots and find Anti-Fur Cloak';
    for (let i = 0; i < 28; i++) addCoin(-14 + (i % 7) * 5, 1.4 + (i % 3 === 0 ? 0.8 : 0), -8 + Math.floor(i / 7) * 7);
    for (let i = 0; i < 6; i++) addEnemy(-16 + i * 6, 10, { hp: 55, range: 14 });
    addPickup(18, 1.8, -16, 'cloak'); addPickup(-8, 1.6, 14, 'health'); addPortal(24, 20);
  }
  if (n === 6) {
    state.objective = 'Defeat 5 Junk Bots and find Mind Magnet';
    for (let i = 0; i < 5; i++) addEnemy(-10 + i * 6, -10, { hp: 58, range: 14 });
    for (let i = 0; i < 14; i++) addCoin(-18 + (i % 7) * 6, 1.4, 16 + Math.floor(i / 7) * 7);
    addPickup(18, 1.8, 12, 'magnet'); addPickup(-12, 1.6, 18, 'energy');
    addPortal(24, -12);
  }
  if (n === 7) {
    state.objective = 'Defeat 6 Power Bots, recharge, collect battery';
    for (let i = 0; i < 6; i++) addEnemy(-15 + i * 6, 14, { hp: 62, range: 14 });
    for (let i = 0; i < 20; i++) addCoin(-20 + (i % 10) * 4, 1.4, -12 + Math.floor(i / 10) * 20);
    addHazard(-8, 0, 8, 6, 'electric'); addHazard(8, 0, 8, 6, 'electric');
    addPickup(0, 1.7, 20, 'battery'); addPickup(12, 1.5, -8, 'health');
    state.unlocked.dash = true; addPortal(22, 22);
  }
  if (n === 8) {
    state.objective = 'Defeat DogBot 9000 and reach portal';
    const b = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 8), new THREE.MeshStandardMaterial({ color: 0x8a8a9f, emissive: 0x330000 }));
    b.position.set(0, 3, -20);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 4), new THREE.MeshBasicMaterial({ color: 0xff6688 }));
    tail.position.set(0, -1.6, -6);
    b.add(tail);
    b.userData = { hp: 240, cooldown: 1.6, phase: 1, tailHp: 70, tail, active: true };
    world.group.add(b); world.boss = b;
    addPickup(-10, 1.6, 10, 'health'); addPickup(10, 1.6, 10, 'energy');
    for (let i = 0; i < 6; i++) addCoin(-10 + i * 4, 1.4, 12);
  }
  hudUpdate();
}

function objectiveComplete() {
  const s = state.levelStats;
  if (state.level === 1) return s.coins >= 10;
  if (state.level === 2) return s.kills >= 5 && s.coins >= 15;
  if (state.level === 3) return s.tokens >= 3 && s.kills >= 3;
  if (state.level === 4) return s.orbs >= 5;
  if (state.level === 5) return s.kills >= 6 && s.cloak;
  if (state.level === 6) return s.kills >= 5 && s.magnet;
  if (state.level === 7) return s.kills >= 6 && s.battery;
  if (state.level === 8) return !world.boss;
  return false;
}

function updateObjectiveText() {
  const s = state.levelStats;
  if (state.level === 1) state.objective = `Collect 10 coins (${s.coins}/10) then reach portal`;
  if (state.level === 2) state.objective = `Defeat 5 pups (${s.kills}/5), collect 15 coins (${s.coins}/15)`;
  if (state.level === 3) state.objective = `Tokens ${s.tokens}/3 and drones ${s.kills}/3`;
  if (state.level === 4) state.objective = `Collect energy orbs ${s.orbs}/5`;
  if (state.level === 5) state.objective = `Bots ${s.kills}/6, cloak ${s.cloak ? 'found' : 'missing'}`;
  if (state.level === 6) state.objective = `Junk bots ${s.kills}/5, magnet ${s.magnet ? 'found' : 'missing'}`;
  if (state.level === 7) state.objective = `Power bots ${s.kills}/6, battery ${s.battery ? 'found' : 'missing'}`;
  if (state.level === 8) state.objective = world.boss ? `Boss HP ${Math.max(0, world.boss.userData.hp)}` : 'Boss defeated! Reach portal';
  if (world.portals) {
    world.portals.userData.locked = !objectiveComplete();
    world.portals.userData.gate.material.color.setHex(world.portals.userData.locked ? 0x6a78aa : 0x57d9ff);
  }
}

function damagePlayer(d) {
  if (!state.alive) return;
  state.health -= d;
  damageLabel(`-${d} HP`, innerWidth / 2, innerHeight / 2, '#ff7a7a');
  player.children[0].material.emissive.setHex(0xff2222);
  setTimeout(() => player.children[0].material.emissive.setHex(0x121f55), 120);
  if (state.health <= 0) {
    state.alive = false;
    gameOverEl.classList.remove('hidden');
  }
}

function respawnFromFall() {
  damagePlayer(15);
  if (!state.alive) return;
  const cp = state.checkpoint || new THREE.Vector3(0, 1.5, 0);
  player.position.copy(cp);
  vy = 0;
}

function attack() {
  if (!state.unlocked.strike || !state.alive) return;
  shadowSlash.visible = true;
  shadowSlash.position.copy(player.position);
  setTimeout(() => { shadowSlash.visible = false; }, 120);
  for (const e of world.enemies) {
    if (!e.userData.active) continue;
    if (e.position.distanceTo(player.position) < 3.2) {
      e.userData.hp -= state.damage;
      e.material.color.setHex(0xffffff);
      setTimeout(() => { if (e.userData.active) e.material.color.setHex(e.userData.type === 'pup' ? 0xff9a55 : e.userData.type === 'drone' ? 0x995dff : 0xff5d8e); }, 90);
      if (e.userData.hp <= 0) {
        e.userData.active = false;
        e.userData.cooldown = 999;
        e.visible = false;
        world.group.remove(e);
        state.levelStats.kills++;
        state.coins += 2;
      }
    }
  }
  if (world.boss && world.boss.position.distanceTo(player.position) < 9) {
    const b = world.boss;
    if (b.userData.phase === 1 && b.userData.tailHp > 0) {
      b.userData.tailHp -= state.damage;
      b.userData.tail.material.color.setHex(0xffdddd);
      setTimeout(() => b.userData.tail.material.color.setHex(0xff6688), 80);
      if (b.userData.tailHp <= 0) { b.userData.phase = 2; b.userData.tail.visible = false; }
    } else {
      b.userData.hp -= state.damage;
      b.material.emissive.setHex(0xaa1111);
      setTimeout(() => { if (world.boss) b.material.emissive.setHex(0x330000); }, 120);
    }
  }
}

function pickupApply(type) {
  if (type === 'token') { state.levelStats.tokens++; state.tokens++; }
  if (type === 'orb') { state.levelStats.orbs++; state.energy = Math.min(state.maxEnergy, state.energy + 25); }
  if (type === 'health') state.health = Math.min(state.maxHealth, state.health + 30);
  if (type === 'energy') state.energy = Math.min(state.maxEnergy, state.energy + 35);
  if (type === 'cloak') state.levelStats.cloak = true;
  if (type === 'magnet') state.levelStats.magnet = true;
  if (type === 'battery') state.levelStats.battery = true;
}

function animate(t = 0) {
  requestAnimationFrame(animate);
  const dt = 0.016;

  if (state.alive) {
    const sp = 0.18 * ((keys.ShiftLeft || keys.ShiftRight) && state.unlocked.dash ? 2.1 : 1);
    const dir = new THREE.Vector3((keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), 0, (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0));
    if (dir.length()) {
      dir.normalize().multiplyScalar(sp).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      player.position.add(dir);
    }

    if (keys.Space && Math.abs(vy) < 0.001) vy = 0.23;
    vy -= 0.012;
    player.position.y += vy;

    // crude ground collision against all platforms
    let grounded = false;
    for (const p of world.platforms) {
      const s = p.geometry.parameters;
      const top = p.position.y + s.height / 2;
      const inX = Math.abs(player.position.x - p.position.x) <= s.width / 2 - 0.2;
      const inZ = Math.abs(player.position.z - p.position.z) <= s.depth / 2 - 0.2;
      if (inX && inZ && player.position.y <= top + 1.5 && player.position.y >= top + 0.6 && vy <= 0) {
        player.position.y = top + 1.5; vy = 0; grounded = true;
      }
    }
    if (!grounded && player.position.y < -10) respawnFromFall();

    camera.position.lerp(new THREE.Vector3(player.position.x + Math.sin(yaw) * 10, player.position.y + 6 + pitch * 2, player.position.z + Math.cos(yaw) * 10), 0.12);
    camera.lookAt(player.position.x, player.position.y + 1.4, player.position.z);

    world.coins = world.coins.filter(c => {
      c.rotation.z += 0.08;
      c.position.y += Math.sin(t * 0.003 + c.position.x) * 0.004;
      if (c.position.distanceTo(player.position) < 1.25) {
        world.group.remove(c); state.coins++; state.levelStats.coins++; return false;
      }
      return true;
    });

    for (const h of world.hazards) {
      if (h.cooldown > 0) h.cooldown -= dt;
      if (h.mesh.position.distanceTo(player.position) < 2.4 && h.cooldown <= 0) {
        damagePlayer(h.damage); h.cooldown = 1.0;
      }
    }

    // AI near player only + patrol/idle/chase logic
    for (const e of world.enemies) {
      if (!e.userData.active) continue;
      const d = e.position.distanceTo(player.position);
      if (d < e.userData.detectRange) e.userData.chasing = true;
      if (d > e.userData.chaseRange) e.userData.chasing = false;
      if (d < 20) {
        if (e.userData.chasing) {
          const toward = player.position.clone().sub(e.position).setY(0);
          const step = toward.normalize().multiplyScalar(e.userData.speed);
          e.position.add(step);
          e.lookAt(player.position.x, e.position.y, player.position.z);
        } else {
          e.position.y = 1 + Math.sin(t * 0.006 + e.userData.home.x) * 0.05;
        }
        if (e.userData.cooldown > 0) e.userData.cooldown -= dt;
        if (d < e.userData.attackRange && e.userData.cooldown <= 0) {
          damagePlayer(10);
          e.userData.cooldown = 1.0;
          e.position.add(player.position.clone().sub(e.position).setY(0).normalize().multiplyScalar(0.35));
        }
      }
    }

    world.enemies = world.enemies.filter(e => e.userData.active);

    world.pickups = world.pickups.filter(p => {
      if (!p.active) return false;
      p.mesh.rotation.y += 0.04;
      if (p.mesh.position.distanceTo(player.position) < 1.4) {
        pickupApply(p.type);
        p.active = false;
        world.group.remove(p.mesh);
        return false;
      }
      return true;
    });

    if (world.portals && world.portals.position.distanceTo(player.position) < 2.2) {
      if (world.portals.userData.locked) {
        if (portalWarnCooldown <= 0) {
          damageLabel('Complete the objective first!', innerWidth * 0.45, innerHeight * 0.18, '#ffdf78');
          portalWarnCooldown = 1.2;
        }
      } else {
        if (state.level < 8) { shop.classList.remove('hidden'); state.alive = false; }
        else { victoryEl.classList.remove('hidden'); state.alive = false; }
      }
    }

    if (world.boss && world.boss.userData.active) {
      const b = world.boss;
      b.userData.cooldown -= dt;
      if (b.userData.cooldown < 0) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 2), new THREE.MeshBasicMaterial({ color: b.userData.phase === 1 ? 0xff7799 : 0xff2222 }));
        p.position.copy(b.position);
        const aim = player.position.clone().sub(b.position).normalize().multiplyScalar(0.42);
        p.userData = { v: aim, active: true };
        world.group.add(p); world.projectiles.push(p);
        b.userData.cooldown = 1.35;
      }
      if (b.userData.hp <= 0) {
        b.userData.active = false;
        world.group.remove(b); world.boss = null;
        if (!world.portals) addPortal(0, 20);
      }
    }

    world.projectiles = world.projectiles.filter(p => {
      p.position.add(p.userData.v);
      if (p.position.distanceTo(player.position) < 1.1) { damagePlayer(12); world.group.remove(p); return false; }
      if (p.position.length() > 260) { world.group.remove(p); return false; }
      return true;
    });

    // checkpoint detection near specific raised markers
    for (const cp of world.checkpoints) {
      if (player.position.distanceTo(cp) < 2.0) state.checkpoint = cp.clone();
    }
  }

  if (portalWarnCooldown > 0) portalWarnCooldown -= dt;
  updateObjectiveText();
  hudUpdate();

  const tag = player.userData.nameTag;
  if (tag) {
    const p = player.position.clone().add(new THREE.Vector3(0, 2.6, 0)).project(camera);
    tag.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`;
    tag.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`;
  }

  world.labels = world.labels.filter(l => {
    l.t -= 0.02; l.y -= 0.8; l.el.style.left = l.x + 'px'; l.el.style.top = l.y + 'px'; l.el.style.opacity = l.t;
    if (l.t <= 0) { l.el.remove(); return false; }
    return true;
  });

  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyF') attack(); });
addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('mousedown', e => { if (e.button === 0) holdMouse = true; });
addEventListener('mouseup', () => { holdMouse = false; });
addEventListener('mousemove', e => {
  if (!holdMouse) return;
  yaw -= e.movementX * 0.004;
  pitch = Math.max(-0.4, Math.min(0.8, pitch - e.movementY * 0.003));
});

document.getElementById('continueBtn').onclick = () => {
  shop.classList.add('hidden');
  state.level++;
  state.alive = true;
  buildLevel(state.level);
};

document.querySelectorAll('#shop button[data-upgrade]').forEach(b => b.onclick = () => {
  const t = b.dataset.upgrade;
  const c = t === 'damage' ? 25 : 20;
  if (state.coins < c) return;
  state.coins -= c;
  if (t === 'health') { state.maxHealth += 20; state.health += 20; }
  if (t === 'energy') { state.maxEnergy += 20; state.energy += 20; }
  if (t === 'damage') state.damage += 5;
});

document.getElementById('restartBtn').onclick = document.getElementById('playAgainBtn').onclick = () => location.reload();

buildLevel(1);
animate();
