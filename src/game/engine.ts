import * as THREE from "three";
import { WEAPONS, WMAP, buildParts, type Weapon, type Attachments, type WClass } from "./weapons";
import { Sfx } from "./audio";

export interface HudState {
  hp: number; armor: number; ammo: number; mag: number; reloading: boolean; reloadPct: number;
  wid: string; wname: string; wcls: string; otherName: string; otherAmmo: number; otherMag: number;
  score: number; combo: number; comboPct: number; mult: number; wave: number; alive: number; kills: number;
  ads: boolean; zoom: number; spread: number; sprint: boolean; banner: string; bannerSub: string;
  toast: string; feed: { id: number; text: string; crit: boolean }[]; hurt: number; grounded: boolean;
  hitmark: number;
  nades: number; dead: boolean; respawnT: number; mp: boolean; pvp: boolean;
  crouched: boolean; sliding: boolean;
}
export interface Stats { score: number; wave: number; kills: number; headshots: number; acc: number; time: number; best: string }

type Cb = {
  onHud: (h: HudState) => void;
  onOver: (s: Stats) => void;
};

const N = 128;           // Map size increased to 128 (Almost 4x total block area)
const HALF = N / 2;
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Particle {
  p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; size: number;
  col: THREE.Color; grav: number; drag: number; spin: number; rot: number;
}
export interface Enemy {
  alive: boolean; type: number; hp: number; maxHp: number; g: THREE.Group;
  pos: THREE.Vector3; vel: THREE.Vector3; scale: number; speed: number; dmg: number; score: number;
  grounded: boolean; anim: number; atkCd: number; fuse: number; flash: number; strafe: number; wobble: number;
  mats: THREE.MeshLambertMaterial[]; baseCol: number; hitT: number;
  netPos: THREE.Vector3; netYaw: number; netFresh: boolean;
  armed: boolean; // Carrying weapon & shooting back!
  aimT: number;
}
interface Pickup { mesh: THREE.Group; label: THREE.Sprite; kind: number; t: number; alive: boolean; wid?: string }

const ETYPES = [
  { hp: 100, speed: 2.8, dmg: 14, score: 100, scale: 1.0, col: 0x59a83f, acc: 0x2f6b28, name: "GRUNT", armed: false },
  { hp: 60, speed: 5.2, dmg: 10, score: 150, scale: 0.82, col: 0xc4643a, acc: 0x7a3a1c, name: "RUNNER", armed: false },
  { hp: 380, speed: 2.1, dmg: 30, score: 300, scale: 1.65, col: 0x7a4fa8, acc: 0x3f2560, name: "BRUTE", armed: false },
  { hp: 75, speed: 3.8, dmg: 48, score: 200, scale: 1.05, col: 0x25c46a, acc: 0x0d6b38, name: "CREEP", armed: false },
  { hp: 110, speed: 2.4, dmg: 20, score: 250, scale: 1.05, col: 0x3a4b60, acc: 0x1f2b3b, name: "MARAUDER", armed: true } // armed!
];

/** Multiplayer bridge — injected by the net layer, null in single player. */
export interface MPBridge {
  active: boolean;
  isHost: boolean;
  pvp: boolean;
  myId: string;
  update(dt: number): void;
  onFire(origin: THREE.Vector3, end: THREE.Vector3, wid: string): void;
  onEnemyHit(idx: number, dmg: number, head: boolean): void;
  onEnemyKill(idx: number, by: string, head: boolean, score: number): void;
  onPlayerHit(target: string, dmg: number, head: boolean): void;
  onDeath(by: string): void;
  onRespawn(p: THREE.Vector3): void;
  onGrenade(p: THREE.Vector3, v: THREE.Vector3): void;
  spawnNade(p: THREE.Vector3, v: THREE.Vector3, mine: boolean): void;
  hitPlayers(origin: THREE.Vector3, dir: THREE.Vector3, maxT: number):
    { id: string; t: number; head: boolean; point: THREE.Vector3 } | null;
  nearestTarget(from: THREE.Vector3): { id: string; pos: THREE.Vector3 } | null;
  playersInRadius(p: THREE.Vector3, radius: number): { id: string; dist: number }[];
}

export class Game {
  cb: Cb;
  canvas: HTMLCanvasElement;
  fxLayer: HTMLDivElement;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  cam: THREE.PerspectiveCamera;
  sfx = new Sfx();
  touchDevice = false;

  // world
  heights = new Uint8Array(N * N);
  worldMesh!: THREE.InstancedMesh;

  // player
  pos = new THREE.Vector3(0, 1, 0);
  vel = new THREE.Vector3();
  yaw = 0; pitch = 0;
  hp = 100; armor = 0; grounded = false; bob = 0; bobAmt = 0;
  recoilP = 0; recoilY = 0; shake = 0; shakeV = new THREE.Vector3();
  hurtT = 0; ads = false; adsT = 0; sprinting = false;
  viewY = 0;

  // slide & crouch
  crouched = false;
  sliding = false;
  slideT = 0;
  slideDir = new THREE.Vector3();
  crouchT = 0; // for view height transition

  // guns
  slots: Weapon[] = [];
  slotAmmo: number[] = [];
  cur = 0;
  gunGroup = new THREE.Group();
  gunPivot = new THREE.Group();
  gunParts: THREE.Mesh[] = [];
  muzzleLocal = new THREE.Vector3();
  fireCd = 0; reloadT = 0; reloadDur = 0; swapT = 0;
  kick = 0; kickV = 0; gunRoll = 0;
  flash!: THREE.PointLight; flashMesh!: THREE.Mesh; flashT = 0;

  // attachments state
  attachments: Record<string, Attachments> = {};

  // single / multi-player
  mp: MPBridge | null = null;
  pvp = false;
  dead = false; respawnT = 0; lastKiller = "";
  nades = 3; nadeCd = 0;
  sens = 1.0; touchSens = 1.0; invertY = false;

  // state
  running = false; over = false; paused = false;
  score = 0; kills = 0; headshots = 0; shots = 0; hits = 0; combo = 0; comboT = 0;
  wave = 0; waveState: "idle" | "break" | "fight" = "idle"; breakT = 0; spawnQ = 0; spawnT = 0;
  time = 0; banner = ""; bannerSub = ""; bannerT = 0; toast = ""; toastT = 0;
  feed: { id: number; text: string; crit: boolean }[] = [];
  feedId = 0; weaponKills: Record<string, number> = {};

  enemies: Enemy[] = [];
  pickups: Pickup[] = [];
  parts: Particle[] = [];
  pMesh!: THREE.InstancedMesh;
  tracers: { m: THREE.Mesh; t: number }[] = [];
  dmgPool: { el: HTMLDivElement; p: THREE.Vector3; t: number; life: number }[] = [];

  // input key bindings
  keys: Record<string, boolean> = {};
  keyMap = {
    forward: "KeyW", backward: "KeyS", left: "KeyA", right: "KeyD",
    jump: "Space", crouch: "KeyC", reload: "KeyR", grenade: "KeyG", swap: "KeyQ"
  };
  firing = false;
  touch = { mx: 0, my: 0, fire: false, jump: false, ads: false, sprint: false, nade: false, crouch: false };
  private raf = 0; private last = 0;
  private dummy = new THREE.Object3D();
  private col = new THREE.Color();
  private hudSig = "";

  // gun viewmodel isolation
  gunScene = new THREE.Scene();
  gunCam = new THREE.PerspectiveCamera(62, 1, 0.01, 12);

  constructor(canvas: HTMLCanvasElement, fxLayer: HTMLDivElement, cb: Cb) {
    this.canvas = canvas; this.fxLayer = fxLayer; this.cb = cb;
    this.touchDevice = matchMedia("(pointer: coarse)").matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.touchDevice ? 1.25 : 1.75));
    this.cam = new THREE.PerspectiveCamera(75, 1, 0.05, 380);
    this.scene.fog = new THREE.Fog(0x8faee8, 60, 240);
    this.scene.background = new THREE.Color(0x8faee8);
    this.buildLights();
    this.buildWorld();
    this.buildFx();
    this.scene.add(this.cam);
    this.gunPivot.add(this.gunGroup);
    
    // Viewmodel scene isolation to prevent clipping into world geometry
    this.gunScene.add(this.gunPivot);
    this.gunScene.add(new THREE.HemisphereLight(0xdfeaff, 0x39404a, 1.6));
    const gl = new THREE.DirectionalLight(0xfff3d6, 1.35);
    gl.position.set(0.6, 1.2, 0.4);
    this.gunScene.add(gl);
    this.gunScene.add(this.gunCam);

    this.resize();
    addEventListener("resize", this.resize);
    addEventListener("keydown", this.onKey);
    addEventListener("keyup", this.onKeyUp);
    document.addEventListener("pointerlockchange", this.onPL);
    canvas.addEventListener("mousedown", this.onMouseDown);
    addEventListener("mouseup", this.onMouseUp);
    addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("wheel", this.onWheel, { passive: true });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    for (let i = 0; i < 24; i++) {
      const el = document.createElement("div");
      el.className = "dmgnum";
      el.style.opacity = "0";
      fxLayer.appendChild(el);
      this.dmgPool.push({ el, p: new THREE.Vector3(), t: 0, life: 0 });
    }
  }

  /* ---------------- setup ---------------- */
  buildLights() {
    const hemi = new THREE.HemisphereLight(0xd8ecff, 0x3a4235, 1.2);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff5e0, 1.15);
    dir.position.set(60, 90, 40);
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0x8faaff, 0.35);
    fill.position.set(-60, 30, -50);
    this.scene.add(fill);
  }

  hAt(x: number, z: number) {
    const i = Math.floor(x + HALF), j = Math.floor(z + HALF);
    if (i < 0 || j < 0 || i >= N || j >= N) return 12;
    return this.heights[j * N + i];
  }

  buildWorld() {
    const h = this.heights;
    const noise = (x: number, y: number, s: number) =>
      Math.sin(x * s) * Math.cos(y * s * 1.3) + Math.sin((x + y) * s * 0.7) * 0.6;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const dx = i - HALF, dz = j - HALF;
        const d = Math.hypot(dx, dz);
        let v = 0;
        const n = noise(i, j, 0.08) + noise(i, j, 0.24) * 0.4;
        if (n > 1.2) v = 1;
        if (d > HALF - 3) v = 8;            // high outer boundaries
        else if (d > HALF - 5) v = Math.random() < 0.4 ? 1 : 0;
        h[j * N + i] = v;
      }
    }
    // scattered cover structures across the expanded map
    const put = (cx: number, cz: number, w: number, d: number, ht: number) => {
      for (let j = cz; j < cz + d; j++) for (let i = cx; i < cx + w; i++) {
        if (i < 3 || j < 3 || i >= N - 3 || j >= N - 3) continue;
        h[j * N + i] = Math.max(h[j * N + i], ht);
      }
    };
    for (let k = 0; k < 95; k++) {
      const cx = 6 + Math.floor(Math.random() * (N - 14));
      const cz = 6 + Math.floor(Math.random() * (N - 14));
      if (Math.hypot(cx - HALF, cz - HALF) < 8) continue;
      const r = Math.random();
      if (r < 0.4) put(cx, cz, 2 + ((Math.random() * 4) | 0), 2 + ((Math.random() * 4) | 0), 1 + ((Math.random() * 3) | 0));
      else if (r < 0.7) put(cx, cz, 1, 1, 2 + ((Math.random() * 4) | 0));
      else if (r < 0.9) { put(cx, cz, 6 + ((Math.random() * 8) | 0), 1, 2 + ((Math.random() * 2) | 0)); }
      else put(cx, cz, 1, 8 + ((Math.random() * 8) | 0), 3);
    }
    // central platform
    put(HALF - 6, HALF - 6, 12, 12, 1);
    put(HALF - 2, HALF - 2, 4, 4, 2);

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: false });
    const mesh = new THREE.InstancedMesh(geo, mat, N * N);
    const d = this.dummy, c = this.col;
    let idx = 0;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const top = h[j * N + i];
        const hh = top + 3;
        d.position.set(i - HALF + 0.5, (top - 3) / 2, j - HALF + 0.5);
        d.scale.set(1, hh, 1);
        d.rotation.set(0, 0, 0);
        d.updateMatrix();
        mesh.setMatrixAt(idx, d.matrix);
        let base: number;
        if (top >= 6) base = 0x6e7682;
        else if (top >= 3) base = 0x827d72;
        else if (top >= 1) base = 0x907e59;
        else base = 0x4d8b3a; // beautiful green voxel ground
        c.setHex(base);
        const t = (Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;
        const v = 1 + (Math.abs(t) - 0.5) * 0.15;
        c.multiplyScalar(v);
        mesh.setColorAt(idx, c);
        idx++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    this.worldMesh = mesh;
    this.scene.add(mesh);

    // procedural high-quality clouds
    const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xf5f8ff, transparent: true, opacity: 0.82 });
    const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, 100);
    for (let k = 0; k < 100; k++) {
      d.position.set(rand(-180, 180), rand(36, 60), rand(-180, 180));
      d.scale.set(rand(10, 24), rand(2.0, 4.2), rand(10, 24));
      d.updateMatrix(); clouds.setMatrixAt(k, d.matrix);
    }
    clouds.instanceMatrix.needsUpdate = true;
    clouds.frustumCulled = false;
    this.scene.add(clouds);
  }

  buildFx() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ emissiveIntensity: 1 });
    this.pMesh = new THREE.InstancedMesh(geo, mat, 800);
    this.pMesh.frustumCulled = false;
    this.pMesh.count = 0;
    this.scene.add(this.pMesh);

    for (let i = 0; i < 30; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.035, 1.2),
        new THREE.MeshBasicMaterial({ color: 0xffe090, transparent: true, opacity: 0.9 })
      );
      m.visible = false; m.frustumCulled = false;
      this.scene.add(m);
      this.tracers.push({ m, t: 0 });
    }
    this.flash = new THREE.PointLight(0xffea95, 0, 15, 2);
    this.scene.add(this.flash);
    this.flashMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xfffcf0, transparent: true, opacity: 0.95 })
    );
    this.flashMesh.visible = false;
    this.gunScene.add(this.flashMesh);

    // enemy pool
    for (let i = 0; i < 48; i++) this.enemies.push(this.makeEnemy());
  }

  makeEnemy(): Enemy {
    const g = new THREE.Group();
    const mats: THREE.MeshLambertMaterial[] = [];
    const skin = new THREE.MeshLambertMaterial({ color: 0x59a83f });
    const acc = new THREE.MeshLambertMaterial({ color: 0x2f6b28 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x232a20 });
    mats.push(skin, acc, dark);
    const box = (w: number, h: number, d2: number, x: number, y: number, z: number, m: THREE.Material, name?: string) => {
      const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d2), m);
      me.position.set(x, y, z); me.name = name || "";
      g.add(me); return me;
    };
    box(0.52, 0.52, 0.52, 0, 1.5, 0, skin, "head");
    box(0.16, 0.1, 0.03, -0.12, 1.56, -0.27, dark);
    box(0.16, 0.1, 0.03, 0.12, 1.56, -0.27, dark);
    box(0.66, 0.66, 0.36, 0, 0.95, 0, acc, "torso");
    const la = box(0.18, 0.62, 0.2, -0.42, 0.98, 0, skin, "armL");
    const ra = box(0.18, 0.62, 0.2, 0.42, 0.98, 0, skin, "armR");
    const ll = box(0.22, 0.62, 0.24, -0.16, 0.32, 0, dark, "legL");
    const rl = box(0.22, 0.62, 0.24, 0.16, 0.32, 0, dark, "legR");
    [la, ra, ll, rl].forEach((m) => (m.geometry.translate(0, m.name.startsWith("arm") ? -0.28 : -0.28, 0)));
    la.position.y = 1.26; ra.position.y = 1.26; ll.position.y = 0.62; rl.position.y = 0.62;

    // Armed enemies carry a rifle model visible on them
    const weaponModel = box(0.1, 0.12, 0.72, 0.32, 0.9, -0.25, new THREE.MeshLambertMaterial({ color: 0x1a1a1c }), "gun");
    weaponModel.visible = false;

    g.visible = false;
    this.scene.add(g);
    return {
      alive: false, type: 0, hp: 1, maxHp: 1, g, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
      scale: 1, speed: 1, dmg: 1, score: 0, grounded: false, anim: 0, atkCd: 0, fuse: -1, flash: 0,
      strafe: 0, wobble: Math.random() * TAU, mats, baseCol: 0x59a83f, hitT: 0,
      netPos: new THREE.Vector3(), netYaw: 0, netFresh: false, armed: false, aimT: 0,
    };
  }

  /* ---------------- gun model ---------------- */
  buildGun(w: Weapon) {
    this.gunParts.forEach((m) => { m.geometry.dispose(); (m.material as THREE.Material).dispose(); this.gunGroup.remove(m); });
    this.gunParts = [];
    const att = this.attachments[w.id];
    const parts = buildParts(w.shape, att);
    for (const [x, y, z, sx, sy, sz, c] of parts) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(sx, sy, sz),
        new THREE.MeshLambertMaterial({ color: c })
      );
      m.position.set(x, y, z);
      m.renderOrder = 10;
      (m.material as THREE.MeshLambertMaterial).depthTest = true;
      this.gunGroup.add(m);
      this.gunParts.push(m);
    }
    const s = w.shape;
    const muzzleZ = -(s.body + s.barrel + (s.can || (att && att.muzzle === "suppressor") ? 0.28 : 0.02));
    this.muzzleLocal.set(0, 0.01, muzzleZ);
    // hands
    const hand = (x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.14), new THREE.MeshLambertMaterial({ color: 0xc99a6b }));
      m.position.set(x, y, z);
      this.gunGroup.add(m); this.gunParts.push(m);
    };
    hand(0, -(s.bodyH ?? 0.14) / 2 - 0.11, 0.02);
    if (s.body + s.barrel > 0.5) hand(0, -(s.bodyH ?? 0.14) / 2 - 0.1, -(s.body + s.barrel * 0.45));
  }

  /* ---------------- lifecycle ---------------- */
  start(loadout: string[], opts?: {
    mp?: MPBridge | null; pvp?: boolean; sens?: number; touchSens?: number; invertY?: boolean; useTouch?: boolean;
    attachments?: Record<string, Attachments>;
  }) {
    this.mp = opts?.mp ?? null;
    this.pvp = !!opts?.pvp;
    this.sens = opts?.sens ?? this.sens;
    this.touchSens = opts?.touchSens ?? this.touchSens;
    this.invertY = opts?.invertY ?? this.invertY;
    this.attachments = opts?.attachments ?? {};
    if (opts?.useTouch !== undefined) this.touchDevice = opts.useTouch;
    this.dead = false; this.respawnT = 0; this.nades = 3; this.nadeCd = 0;
    this.localNades.length = 0;

    this.sfx.init(); this.sfx.resume();
    this.slots = [WMAP[loadout[0]] ?? WEAPONS[0], WMAP[loadout[1]] ?? WEAPONS[15]];
    this.slotAmmo = [this.slots[0].mag, this.slots[1].mag];
    this.cur = 0;
    this.buildGun(this.slots[0]);
    this.pos.set(0.5, this.hAt(0.5, 0.5) + 0.1, 0.5);
    this.viewY = this.pos.y;
    this.vel.set(0, 0, 0);
    this.yaw = 0; this.pitch = 0;
    this.hp = 100; this.armor = 0;
    this.score = 0; this.kills = 0; this.headshots = 0; this.shots = 0; this.hits = 0;
    this.combo = 0; this.comboT = 0; this.wave = 0; this.time = 0;
    this.weaponKills = {}; this.feed = [];
    this.enemies.forEach((e) => { e.alive = false; e.g.visible = false; });
    this.pickups.forEach((p) => { this.scene.remove(p.mesh); this.scene.remove(p.label); });
    this.pickups = [];
    this.parts.length = 0;
    this.over = false; this.paused = false; this.running = true;
    this.gunPivot.visible = true;
    this.hudSig = "";
    this.waveState = "break"; this.breakT = 1.6;
    this.setBanner("GET READY", "WAVE 1 INCOMING");
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
    if (!this.touchDevice) this.lock();
  }
  lock() { try { const r = this.canvas.requestPointerLock?.() as unknown as Promise<void> | undefined; r?.catch?.(() => {}); } catch { /* ignore */ } }
  pause() {
    if (!this.running || this.over) return;
    this.paused = true; this.firing = false;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }
  resume() {
    if (!this.running || this.over) return;
    this.paused = false; this.last = performance.now();
    this.sfx.resume();
    if (!this.touchDevice) this.lock();
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  dispose() {
    this.stop();
    removeEventListener("resize", this.resize);
    removeEventListener("keydown", this.onKey);
    removeEventListener("keyup", this.onKeyUp);
    removeEventListener("mouseup", this.onMouseUp);
    removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onPL);
    this.renderer.dispose();
  }

  /* ---------------- input ---------------- */
  resize = () => {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
    this.gunCam.aspect = w / h;
    this.gunCam.updateProjectionMatrix();
  };
  onPL = () => { if (this.running && !this.paused && !this.over && document.pointerLockElement !== this.canvas) this.cb.onHud(this.hud()); };
  
  onKey = (e: KeyboardEvent) => {
    if (["Tab", "Space", "KeyR", "KeyC", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
    this.keys[e.code] = true;
    if (!this.running || this.paused || this.over) return;
    if (e.code === this.keyMap.reload) this.startReload();
    if (e.code === this.keyMap.grenade) this.throwGrenade();
    if (e.code === this.keyMap.swap) this.swap();
    if (e.code === "Digit1") this.selectSlot(0);
    if (e.code === "Digit2") this.selectSlot(1);
  };
  onKeyUp = (e: KeyboardEvent) => { this.keys[e.code] = false; };
  onMouseDown = (e: MouseEvent) => {
    if (!this.running || this.paused || this.over) return;
    if (document.pointerLockElement !== this.canvas && !this.touchDevice) { this.lock(); return; }
    if (e.button === 0) { this.firing = true; this.tryFire(); }
    if (e.button === 2) this.ads = true;
  };
  onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.firing = false;
    if (e.button === 2) this.ads = false;
  };
  onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.canvas || this.paused || this.over) return;
    const s = 0.0022 * this.sens * (this.ads ? 1 / Math.sqrt(this.zoomNow()) : 1);
    this.yaw -= e.movementX * s;
    this.pitch = clamp(this.pitch - e.movementY * s * (this.invertY ? -1 : 1), -1.5, 1.5);
  };
  onWheel = () => { if (this.running && !this.paused && !this.over) this.swap(); };
  touchLook(dx: number, dy: number) {
    const s = 0.0045 * this.touchSens * (this.ads ? 1 / Math.sqrt(this.zoomNow()) : 1);
    this.yaw -= dx * s;
    this.pitch = clamp(this.pitch - dy * s * (this.invertY ? -1 : 1), -1.5, 1.5);
  }

  zoomNow() { return this.slots[this.cur]?.zoom ?? 1; }
  get weapon() { return this.slots[this.cur]; }

  selectSlot(i: number) {
    if (i === this.cur || this.swapT > 0 || !this.slots[i]) return;
    this.cur = i; this.swapT = 0.42; this.reloadT = 0;
    this.buildGun(this.slots[i]);
    this.sfx.click();
  }
  swap() { this.selectSlot(this.cur === 0 ? 1 : 0); }

  startReload() {
    const w = this.weapon;
    if (!w || this.reloadT > 0 || this.slotAmmo[this.cur] >= w.mag) return;
    this.reloadT = w.reload; this.reloadDur = w.reload;
    this.sfx.reload(0);
    setTimeout(() => this.sfx.reload(1), w.reload * 420);
    setTimeout(() => this.sfx.reload(2), w.reload * 800);
  }

  /* ---------------- combat ---------------- */
  rayBox(o: THREE.Vector3, d: THREE.Vector3, c: THREE.Vector3, hx: number, hy: number, hz: number) {
    let tmin = -Infinity, tmax = Infinity;
    const oa = [o.x - c.x, o.y - c.y, o.z - c.z], da = [d.x, d.y, d.z], ha = [hx, hy, hz];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(da[i]) < 1e-6) { if (Math.abs(oa[i]) > ha[i]) return -1; continue; }
      let t1 = (-ha[i] - oa[i]) / da[i], t2 = (ha[i] - oa[i]) / da[i];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
    return tmax < 0 ? -1 : tmin < 0 ? 0 : tmin;
  }

  marchWorld(o: THREE.Vector3, d: THREE.Vector3, maxD: number) {
    const step = 0.2;
    const p = o.clone();
    for (let t = 0; t < maxD; t += step) {
      p.addScaledVector(d, step);
      if (p.y < 0 && this.hAt(p.x, p.z) === 0) return { t, p: p.clone(), hit: true };
      if (p.y >= 0 && p.y < this.hAt(p.x, p.z)) return { t, p: p.clone(), hit: true };
      if (p.y > 26) break;
    }
    return { t: maxD, p: o.clone().addScaledVector(d, maxD), hit: false };
  }

  tryFire() {
    const w = this.weapon;
    if (!w || this.fireCd > 0 || this.reloadT > 0 || this.swapT > 0) return;
    if (this.slotAmmo[this.cur] <= 0) { this.sfx.click(); this.fireCd = 0.25; this.startReload(); return; }
    this.slotAmmo[this.cur]--;
    this.fireCd = 60 / w.rpm;
    this.shots++;

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cam.quaternion).normalize();
    const spreadDeg = (this.ads ? w.adsSpread : w.spread) * (this.sprinting ? 1.7 : 1) * (this.grounded ? 1 : 1.5);
    const sp = (spreadDeg * Math.PI) / 180;
    if (sp > 0) {
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * sp;
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.cam.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.cam.quaternion);
      dir.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
    }
    const origin = new THREE.Vector3().setFromMatrixPosition(this.cam.matrixWorld);
    const range = 150;
    const world = this.marchWorld(origin, dir, range);

    // enemy hits
    type Hit = { e: Enemy; t: number; head: boolean };
    const hits: Hit[] = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const s = e.scale;
      const hc = new THREE.Vector3(e.pos.x, e.pos.y + 1.5 * s, e.pos.z);
      const bc = new THREE.Vector3(e.pos.x, e.pos.y + 0.85 * s, e.pos.z);
      const th = this.rayBox(origin, dir, hc, 0.3 * s, 0.3 * s, 0.3 * s);
      const tb = this.rayBox(origin, dir, bc, 0.42 * s, 0.62 * s, 0.34 * s);
      let t = -1, head = false;
      if (th >= 0 && (tb < 0 || th <= tb)) { t = th; head = true; }
      else if (tb >= 0) { t = tb; head = false; }
      if (t >= 0 && t < world.t) hits.push({ e, t, head });
    }
    hits.sort((a, b) => a.t - b.t);
    let pierced = 0;
    let endT = world.t;
    let anyHit = false;

    // PvP: players block the shot when enabled by the host
    const pvpHit = this.pvp && this.mp && this.mp.active
      ? this.mp.hitPlayers(origin, dir, Math.min(world.t, hits.length ? hits[0].t : world.t))
      : null;
    if (pvpHit) {
      const dmg = w.dmg * (pvpHit.head ? w.head : 1);
      this.mp!.onPlayerHit(pvpHit.id, dmg, pvpHit.head);
      this.burst(pvpHit.point, pvpHit.head ? 14 : 9, pvpHit.head ? 0xffd23f : 0xff5e5e, 0.1, 4.5, 0.45);
      this.spawnDmgNum(pvpHit.point, Math.round(dmg), pvpHit.head);
      if (pvpHit.head) this.sfx.headshot(); else this.sfx.hit();
      this.hitFlash(pvpHit.head);
      this.hits++;
      endT = pvpHit.t;
    } else {
      for (const h of hits) {
        if (pierced >= w.pierce) break;
        pierced++;
        anyHit = true;
        const dmg = w.dmg * (h.head ? w.head : 1) * (h.e.type === 2 ? 0.85 : 1);
        const hp = new THREE.Vector3().copy(origin).addScaledVector(dir, h.t);
        this.damageEnemy(h.e, dmg, h.head, hp, dir);
        if (pierced >= w.pierce) endT = Math.min(world.t, h.t + 0.4);
      }
      if (anyHit) this.hits++;
    }
    if (!anyHit && !pvpHit && world.hit) {
      this.burst(world.p, 10, 0xb9ae95, 0.09, 3.2, 0.35);
      this.pushDecalDust(world.p);
    }

    // tracer + muzzle
    const muzzle = this.cam.localToWorld(this.gunGroup.localToWorld(this.muzzleLocal.clone()));
    const endPoint = origin.clone().addScaledVector(dir, Math.min(endT, range));
    this.spawnTracer(muzzle, endPoint, w.tracer);
    if (this.mp && this.mp.active) this.mp.onFire(muzzle, endPoint, w.id);

    this.flashT = w.quiet ? 0.03 : 0.055;
    this.flash.position.copy(muzzle);
    this.flash.intensity = w.quiet ? 4 : 14;
    this.flashMesh.visible = true;
    this.flashMesh.position.copy(this.gunPivot.position).add(this.gunGroup.position.clone().add(this.muzzleLocal));
    this.flashMesh.scale.setScalar(w.quiet ? 0.5 : 0.7 + Math.random() * 0.6);

    // shells
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.cam.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.cam.quaternion);
    const shellP = origin.clone().addScaledVector(dir, 0.5).addScaledVector(right, 0.18).addScaledVector(up, -0.12);
    const shellV = right.clone().multiplyScalar(rand(1.5, 3)).addScaledVector(up, rand(1, 2.4)).addScaledVector(dir, rand(-1, 0.5));
    this.addParticle(shellP, shellV, 1.1, 0.06, 0xd9b45a, 18, 0.4, 16);

    // recoil
    const rc = w.recoil * (this.ads ? 0.62 : 1);
    this.recoilP += rc * 0.018;
    this.recoilY += rand(-1, 1) * rc * 0.008;
    this.kickV += w.kick * 0.9;
    this.gunRoll += rand(-1, 1) * w.kick * 0.02;
    this.shake = Math.min(1.6, this.shake + w.shake * 0.16);
    this.sfx.shot(w.tone, w.boom, w.quiet);
  }

  pushDecalDust(p: THREE.Vector3) {
    for (let i = 0; i < 3; i++)
      this.addParticle(p.clone(), new THREE.Vector3(rand(-1, 1), rand(0.4, 2), rand(-1, 1)), rand(0.3, 0.7), rand(0.05, 0.12), 0xd7cdb6, 6, 1.5, 4);
  }

  damageEnemy(e: Enemy, dmg: number, head: boolean, at: THREE.Vector3, dir: THREE.Vector3) {
    // immediate local juice — client prediction, reconciled by the host snapshot
    e.flash = 0.09;
    e.hitT = 0.12;
    const c = head ? 0xffd23f : ETYPES[e.type].col;
    this.burst(at, head ? 14 : 9, c, 0.1, 4.5, 0.45);
    this.spawnDmgNum(at, Math.round(dmg), head);
    if (head) this.sfx.headshot(); else this.sfx.hit();
    this.hitFlash(head);
    const mp = this.mp;
    if (mp && mp.active && !mp.isHost) {
      mp.onEnemyHit(this.enemies.indexOf(e), dmg, head);
      e.hp = Math.max(1, e.hp - dmg);   // predicted bar, host stays authoritative
      return;
    }
    e.vel.addScaledVector(dir, Math.min(3.4, dmg * 0.02));
    this.applyEnemyDamage(e, dmg, head, mp && mp.active ? mp.myId : "");
  }

  /** Authoritative enemy damage (host / single player). */
  applyEnemyDamage(e: Enemy, dmg: number, head: boolean, by: string) {
    if (!e.alive) return;
    e.hp -= dmg;
    e.flash = 0.09;
    e.hitT = 0.12;
    if (e.hp <= 0) this.killEnemy(e, head, by);
  }

  hitmarkT = 0; hitmarkCrit = false;
  hitFlash(crit: boolean) { this.hitmarkT = 0.16; this.hitmarkCrit = crit; }

  enemyDeathFx(e: Enemy, head: boolean) {
    this.sfx.kill();
    const t = ETYPES[e.type];
    for (let i = 0; i < 22; i++) {
      const p = e.pos.clone().add(new THREE.Vector3(rand(-0.3, 0.3), rand(0.3, 1.6) * e.scale, rand(-0.3, 0.3)));
      this.addParticle(p, new THREE.Vector3(rand(-4, 4), rand(2, 7), rand(-4, 4)), rand(0.5, 1.1),
        rand(0.1, 0.22) * e.scale, i % 3 === 0 ? t.acc : t.col, 16, 0.6, 12);
    }
    this.shake = Math.min(1.8, this.shake + (head ? 0.24 : 0.18));
  }

  private awardKill(e: Enemy, head: boolean, base: number) {
    this.kills++;
    this.combo++; this.comboT = 3.6;
    const gain = Math.round(base * this.mult() * (head ? 1.5 : 1));
    this.score += gain;
    if (head) this.headshots++;
    const wid = this.weapon.id;
    this.weaponKills[wid] = (this.weaponKills[wid] || 0) + 1;
    this.addFeed(`${head ? "HEADSHOT " : ""}${ETYPES[e.type].name} +${gain}`, head);
  }

  killEnemy(e: Enemy, head: boolean, by = "") {
    const idx = this.enemies.indexOf(e);
    e.alive = false; e.g.visible = false;
    const mp = this.mp;
    const net = !!(mp && mp.active);
    const mine = !net || by === "" || by === mp!.myId;
    if (mine) this.awardKill(e, head, e.score);
    this.enemyDeathFx(e, head);
    if (e.type === 3) this.explode(e.pos.clone(), 3.2, 0, 0x35d97a);
    if (net && mp!.isHost) mp!.onEnemyKill(idx, by || mp!.myId, head, e.score);
    // drops (host / single player only — pickups are local convenience items)
    const r = Math.random();
    if (r < 0.1) this.spawnPickup(e.pos, 0);
    else if (r < 0.26) this.spawnPickup(e.pos, 1);
    else if (r < 0.32) this.spawnPickup(e.pos, 2);
  }

  /** Kill confirmed by the host. */
  netKillEnemy(e: Enemy, head: boolean, base: number, mine: boolean) {
    if (!e.alive) return;
    e.alive = false; e.g.visible = false;
    if (mine) this.awardKill(e, head, base);
    this.enemyDeathFx(e, head);
  }

  /** Client-side: adopt the host's authoritative AI snapshot. */
  applyEnemySnapshot(arr: number[], wave: number, q: number, ws: "idle" | "break" | "fight") {
    if (!Array.isArray(arr)) return;
    if (wave !== this.wave && wave > 0) {
      if (wave > this.wave && this.wave > 0) { this.setBanner(`WAVE ${wave}`, "INCOMING"); this.sfx.wave(); }
      this.wave = wave;
    }
    this.spawnQ = q; this.waveState = ws;
    for (const e of this.enemies) e.netFresh = false;
    for (let i = 0; i + 8 < arr.length; i += 9) {
      const idx = arr[i] | 0;
      const e = this.enemies[idx];
      if (!e) continue;
      const type = arr[i + 1] | 0;
      if (!e.alive || e.type !== type) this.netSpawnEnemy(e, type, arr[i + 2], arr[i + 3], arr[i + 4]);
      e.netPos.set(arr[i + 2], arr[i + 3], arr[i + 4]);
      e.netYaw = arr[i + 5];
      e.hp = arr[i + 6];
      e.maxHp = arr[i + 7] || e.maxHp;
      e.fuse = arr[i + 8] ? 0.5 : -1;
      e.netFresh = true;
    }
    for (const e of this.enemies) if (e.alive && !e.netFresh) { e.alive = false; e.g.visible = false; }
  }

  private netSpawnEnemy(e: Enemy, type: number, x: number, y: number, z: number) {
    const t = ETYPES[type];
    e.alive = true; e.type = type; e.scale = t.scale; e.score = t.score;
    e.pos.set(x, y, z); e.netPos.set(x, y, z);
    e.vel.set(0, 0, 0);
    e.hp = t.hp; e.maxHp = t.hp; e.fuse = -1; e.flash = 0; e.hitT = 0;
    e.g.scale.setScalar(t.scale);
    e.g.position.copy(e.pos);
    e.g.visible = true;
    e.baseCol = t.col;
    e.mats[0].color.setHex(t.col); e.mats[0].emissive.setHex(0x000000);
    e.mats[1].color.setHex(t.acc); e.mats[1].emissive.setHex(0x000000);
    e.mats[2].color.setHex(type === 3 ? 0x14803f : 0x232a20);
    e.armed = t.armed;
    e.g.children[8].visible = t.armed; // Gun mesh visibility
  }

  /** Client-side smoothing of networked AI (interpolation, local animation). */
  updateEnemyRemote(e: Enemy, dt: number) {
    const k = Math.min(1, dt * 12);
    const prev = e.pos.clone();
    e.pos.lerp(e.netPos, k);
    e.g.position.copy(e.pos);
    let dy = e.netYaw - e.g.rotation.y;
    while (dy > Math.PI) dy -= TAU;
    while (dy < -Math.PI) dy += TAU;
    e.g.rotation.y += dy * Math.min(1, dt * 10);
    const hv = prev.distanceTo(e.pos) / Math.max(dt, 1e-3);
    e.anim += dt * (2 + hv * 2.4);
    const sw = Math.sin(e.anim * 2.4) * clamp(hv / 3, 0.2, 1.3);
    const ch = e.g.children;
    (ch[6] as THREE.Mesh).rotation.x = sw;
    (ch[7] as THREE.Mesh).rotation.x = -sw;
    (ch[4] as THREE.Mesh).rotation.x = -sw * 0.7 - 1.1;
    (ch[5] as THREE.Mesh).rotation.x = sw * 0.7 - 1.1;
    if (e.flash > 0) {
      e.flash -= dt;
      const on = e.flash > 0;
      e.mats[0].emissive.setHex(on ? 0xff5555 : 0x000000);
      e.mats[1].emissive.setHex(on ? 0x992222 : 0x000000);
    }
    if (e.fuse >= 0) {
      const f = Math.sin(this.time * 40) * 0.5 + 0.5;
      e.mats[0].emissive.setRGB(f, f * 0.3, 0);
      e.g.scale.setScalar(e.scale * (1 + f * 0.14));
    } else if (e.hitT > 0) { e.hitT -= dt; e.g.scale.setScalar(e.scale * (1 + e.hitT * 0.6)); }
    else e.g.scale.setScalar(e.scale);
  }

  /* ---------------- grenades ---------------- */
  throwGrenade() {
    if (this.over || this.dead || this.nades <= 0 || this.nadeCd > 0) return;
    this.nades--;
    this.nadeCd = 0.75;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.cam.quaternion).normalize();
    const p = this.pos.clone().setY(this.pos.y + 1.5).addScaledVector(dir, 0.6);
    const v = dir.multiplyScalar(15).add(new THREE.Vector3(0, 4.2, 0)).add(this.vel.clone().multiplyScalar(0.5));
    this.kickV += 1.2;
    this.sfx.click();
    if (this.mp && this.mp.active) { this.mp.spawnNade(p, v, true); this.mp.onGrenade(p, v); }
    else this.localNades.push({ p, v, fuse: 1.6 });
  }
  localNades: { p: THREE.Vector3; v: THREE.Vector3; fuse: number }[] = [];
  private updateLocalNades(dt: number) {
    for (let i = this.localNades.length - 1; i >= 0; i--) {
      const n = this.localNades[i];
      n.fuse -= dt;
      n.v.y -= 22 * dt;
      n.p.addScaledVector(n.v, dt);
      const gh = this.hAt(n.p.x, n.p.z);
      if (n.p.y < gh + 0.11) { n.p.y = gh + 0.11; n.v.y = Math.abs(n.v.y) * 0.42; n.v.x *= 0.7; n.v.z *= 0.7; }
      this.addParticle(n.p.clone(), new THREE.Vector3(0, 0.2, 0), 0.12, 0.2, 0x2f4a2a, 0, 2, 6);
      if (n.fuse <= 0) { this.localNades.splice(i, 1); this.grenadeBlast(n.p.clone(), true, ""); }
    }
  }
  /** Shared blast: visuals everywhere, enemy damage only on the authority. */
  grenadeBlast(p: THREE.Vector3, authoritative: boolean, owner: string) {
    this.sfx.boom();
    for (let i = 0; i < 46; i++) {
      this.addParticle(p.clone().add(new THREE.Vector3(rand(-0.4, 0.4), rand(0, 1), rand(-0.4, 0.4))),
        new THREE.Vector3(rand(-11, 11), rand(1, 13), rand(-11, 11)), rand(0.4, 1.1), rand(0.1, 0.34),
        i % 2 ? 0xffa63d : 0xffe08a, 14, 0.8, 14);
    }
    const radius = 5.2;
    const d = this.pos.distanceTo(p);
    this.shake = Math.min(2.4, this.shake + 1.1 * clamp(1 - d / 16, 0, 1));
    if (d < radius && !this.dead) this.hurtPlayer(70 * (1 - d / radius), owner);
    if (this.mp && this.mp.active && this.mp.isHost) {
      for (const t of this.mp.playersInRadius(p, radius))
        this.mp.onPlayerHit(t.id, 70 * (1 - t.dist / radius), false);
    }
    if (!authoritative) return;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const de = e.pos.distanceTo(p);
      if (de < radius) {
        e.vel.add(e.pos.clone().sub(p).setY(1).normalize().multiplyScalar(8));
        this.applyEnemyDamage(e, 150 * (1 - de / radius * 0.6), false, owner);
      }
    }
  }

  mult() { return clamp(1 + Math.floor(this.combo / 4), 1, 8); }

  addFeed(text: string, crit: boolean) {
    this.feed = [{ id: this.feedId++, text, crit }, ...this.feed].slice(0, 5);
  }
  setBanner(a: string, b: string) { this.banner = a; this.bannerSub = b; this.bannerT = 2.2; }
  setToast(t: string) { this.toast = t; this.toastT = 2.6; }

  explode(p: THREE.Vector3, radius: number, dmgToPlayer: number, color: number) {
    this.sfx.boom();
    for (let i = 0; i < 40; i++) {
      this.addParticle(p.clone().add(new THREE.Vector3(rand(-0.4, 0.4), rand(0, 1), rand(-0.4, 0.4))),
        new THREE.Vector3(rand(-9, 9), rand(1, 11), rand(-9, 9)), rand(0.4, 1.0), rand(0.1, 0.3),
        i % 2 ? color : 0xffe08a, 14, 0.8, 14);
    }
    const d = this.pos.distanceTo(p);
    if (dmgToPlayer > 0 && d < radius + 1) this.hurtPlayer(dmgToPlayer * (1 - d / (radius + 1)));
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const de = e.pos.distanceTo(p);
      if (de < radius) {
        e.vel.add(e.pos.clone().sub(p).setY(1).normalize().multiplyScalar(6));
        e.hp -= 40;
        if (e.hp <= 0) this.killEnemy(e, false);
      }
    }
    this.shake = Math.min(2.2, this.shake + 0.9 * clamp(1 - d / 14, 0, 1));
  }

  hurtPlayer(amount: number, by = "") {
    if (this.over || this.dead) return;
    let a = amount;
    if (this.armor > 0) { const abs = Math.min(this.armor, a * 0.6); this.armor -= abs; a -= abs; }
    this.hp -= a;
    this.hurtT = 0.5;
    this.shake = Math.min(2, this.shake + 0.35);
    this.sfx.hurt();
    this.combo = 0;
    if (this.hp <= 0) {
      this.hp = 0;
      if (this.mp && this.mp.active) this.killLocal(by);
      else this.gameOver();
    }
  }

  /* ---------------- multiplayer death / respawn ---------------- */
  killLocal(by: string) {
    if (this.dead) return;
    this.dead = true;
    this.lastKiller = by;
    this.respawnT = 3;
    this.firing = false;
    this.combo = 0;
    this.shake = Math.min(2.4, this.shake + 1.2);
    this.sfx.over();
    this.burst(this.pos.clone().setY(this.pos.y + 1), 26, 0xff5e5e, 0.13, 6, 0.7);
    this.gunPivot.visible = false;
    this.mp?.onDeath(by);
    this.setBanner("YOU DIED", "RESPAWNING…");
  }

  pickSpawn() {
    let best = new THREE.Vector3(0.5, 0, 0.5), bestD = -1;
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * TAU, d = rand(12, HALF - 15);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (this.hAt(x, z) > 3) continue;
      let near = 999;
      for (const e of this.enemies) if (e.alive) near = Math.min(near, Math.hypot(e.pos.x - x, e.pos.z - z));
      if (near > bestD) { bestD = near; best.set(x, this.hAt(x, z) + 0.2, z); }
      if (bestD > 25) break;
    }
    return best;
  }

  respawnNow() {
    const p = this.pickSpawn();
    this.pos.copy(p);
    this.viewY = p.y;
    this.vel.set(0, 0, 0);
    this.hp = 100; this.armor = 0;
    this.dead = false; this.respawnT = 0;
    this.nades = 3;
    this.slotAmmo = this.slots.map((s) => s.mag);
    this.reloadT = 0; this.swapT = 0.3;
    this.hurtT = 0;
    this.gunPivot.visible = true;
    this.sfx.pickup();
    this.setBanner("RESPAWNED", "FULL HEALTH");
    this.mp?.onRespawn(p);
  }

  gameOver() {
    this.over = true;
    this.firing = false;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.sfx.over();
    let best = "—", bk = 0;
    for (const k in this.weaponKills) if (this.weaponKills[k] > bk) { bk = this.weaponKills[k]; best = WMAP[k].name; }
    this.cb.onOver({
      score: this.score, wave: Math.max(1, this.wave), kills: this.kills, headshots: this.headshots,
      acc: this.shots ? Math.round((this.hits / this.shots) * 100) : 0, time: Math.round(this.time), best,
    });
  }

  /* ---------------- spawns ---------------- */
  private makeLabel(text: string) {
    const c = document.createElement("canvas");
    c.width = 160; c.height = 40;
    const x = c.getContext("2d")!;
    x.fillStyle = "rgba(10,12,18,0.85)";
    x.fillRect(0, 0, 160, 40);
    x.strokeStyle = "#4dd2ff";
    x.lineWidth = 2;
    x.strokeRect(1, 1, 158, 38);
    x.font = "bold 13px ui-monospace, monospace";
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillStyle = "#fff";
    x.fillText(text, 80, 20);
    const tex = new THREE.CanvasTexture(c);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }));
    s.scale.set(0.95, 0.24, 1);
    s.position.y = 0.55;
    return s;
  }

  spawnPickup(at: THREE.Vector3, kind: number) {
    const g = new THREE.Group();
    const colors = [0xff4d5e, 0xffd23f, 0x4dd2ff];
    const mat = new THREE.MeshLambertMaterial({ color: colors[kind], emissive: colors[kind], emissiveIntensity: 0.35 });
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), mat);
    g.add(core);
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.62),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    ring.position.y = -0.3; g.add(ring);
    g.position.copy(at).setY(this.hAt(at.x, at.z) + 0.6);
    this.scene.add(g);
    let wid: string | undefined;
    let text = "HEALTH PACK";
    if (kind === 1) text = "AMMO REFILL";
    if (kind === 2) {
      wid = WEAPONS[(Math.random() * WEAPONS.length) | 0].id;
      text = WMAP[wid]?.name || "WEAPON";
    }
    const label = this.makeLabel(text);
    label.position.copy(g.position).setY(g.position.y + 0.62);
    this.scene.add(label);

    this.pickups.push({ mesh: g, label, kind, t: 0, alive: true, wid });
  }

  spawnEnemy() {
    const e = this.enemies.find((x) => !x.alive);
    if (!e) return;
    let type = 0;
    const r = Math.random(), w = this.wave;
    // Include the new Marauder armed sniper/rifleman!
    if (w >= 5 && r < 0.25) type = 4;
    else if (w >= 3 && r < 0.2) type = 1;
    else if (w >= 6 && r < 0.35) type = 3;
    else if (w >= 4 && r < 0.45) type = 2;
    else if (r < 0.25 && w >= 2) type = 1;

    const t = ETYPES[type];
    let x = 0, z = 0, tries = 0;
    do {
      const a = Math.random() * TAU, d = rand(16, HALF - 12);
      x = Math.cos(a) * d; z = Math.sin(a) * d;
      tries++;
    } while (tries < 24 && (this.hAt(x, z) > 3 || Math.hypot(x - this.pos.x, z - this.pos.z) < 13));
    e.alive = true; e.type = type;
    const hpScale = 1 + (this.wave - 1) * 0.14;
    e.maxHp = t.hp * hpScale; e.hp = e.maxHp;
    e.speed = t.speed * (1 + Math.min(0.35, (this.wave - 1) * 0.03));
    e.dmg = t.dmg * (1 + (this.wave - 1) * 0.06);
    e.score = t.score; e.scale = t.scale;
    e.pos.set(x, this.hAt(x, z) + 6, z);
    e.vel.set(0, 0, 0);
    e.grounded = false; e.atkCd = 0; e.fuse = -1; e.flash = 0; e.hitT = 0;
    e.g.scale.setScalar(t.scale);
    e.g.visible = true;
    e.baseCol = t.col;
    e.mats[0].color.setHex(t.col); e.mats[0].emissive.setHex(0x000000);
    e.mats[1].color.setHex(t.acc); e.mats[1].emissive.setHex(0x000000);
    e.mats[2].color.setHex(type === 3 ? 0x14803f : 0x232a20);
    e.armed = t.armed;
    e.g.children[8].visible = t.armed;
  }

  /* ---------------- particles / fx ---------------- */
  addParticle(p: THREE.Vector3, v: THREE.Vector3, life: number, size: number, color: number, grav: number, drag: number, spin: number) {
    if (this.parts.length >= 790) this.parts.shift();
    this.parts.push({ p: p.clone(), v: v.clone(), life, max: life, size, col: new THREE.Color(color), grav, drag, spin, rot: Math.random() * TAU });
  }
  burst(p: THREE.Vector3, n: number, color: number, size: number, speed: number, life: number) {
    for (let i = 0; i < n; i++)
      this.addParticle(p, new THREE.Vector3(rand(-1, 1), rand(-0.4, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.4, 1) * speed),
        life * rand(0.6, 1.3), size * rand(0.6, 1.4), color, 9, 1.2, 10);
  }
  spawnTracer(a: THREE.Vector3, b: THREE.Vector3, color: number) {
    const tr = this.tracers.find((t) => t.t <= 0) || this.tracers[0];
    const d = b.distanceTo(a);
    tr.m.visible = true;
    tr.m.position.copy(a).lerp(b, 0.5);
    tr.m.lookAt(b);
    tr.m.scale.set(1, 1, Math.max(0.2, d));
    (tr.m.material as THREE.MeshBasicMaterial).color.setHex(color);
    (tr.m.material as THREE.MeshBasicMaterial).opacity = 0.85;
    tr.t = 0.07;
  }
  spawnDmgNum(p: THREE.Vector3, v: number, crit: boolean) {
    const d = this.dmgPool.find((x) => x.t <= 0) || this.dmgPool[0];
    d.p.copy(p); d.t = 0.75; d.life = 0.75;
    d.el.textContent = crit ? `${v}!` : `${v}`;
    d.el.style.color = crit ? "#ffd23f" : "#ffffff";
    d.el.style.fontSize = crit ? "26px" : "19px";
  }

  /* ---------------- physics ---------------- */
  collide(p: THREE.Vector3, r: number, step: number) {
    const test = (x: number, z: number) => {
      let mx = 0;
      for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++)
        for (let j = Math.floor(z - r); j <= Math.floor(z + r); j++) mx = Math.max(mx, this.hAt(i + 0.5, j + 0.5));
      return mx;
    };
    return test(p.x, p.z) > p.y + step;
  }
  groundAt(x: number, z: number, r: number, limit = Infinity) {
    let mx = -Infinity;
    for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++)
      for (let j = Math.floor(z - r); j <= Math.floor(z + r); j++) {
        const h = this.hAt(i + 0.5, j + 0.5);
        if (h <= limit && h > mx) mx = h;
      }
    return mx === -Infinity ? -20 : mx;
  }

  moveEntity(pos: THREE.Vector3, vel: THREE.Vector3, dt: number, r: number, step: number) {
    const nx = pos.x + vel.x * dt;
    if (!this.collide(new THREE.Vector3(nx, pos.y, pos.z), r, step)) pos.x = nx; else vel.x *= -0.05;
    const nz = pos.z + vel.z * dt;
    if (!this.collide(new THREE.Vector3(pos.x, pos.y, nz), r, step)) pos.z = nz; else vel.z *= -0.05;
    const prevY = pos.y;
    pos.y += vel.y * dt;
    const g = this.groundAt(pos.x, pos.z, r, Math.max(prevY, pos.y) + step);
    if (pos.y <= g) { pos.y = g; vel.y = 0; return true; }
    return false;
  }

  /* ---------------- update ---------------- */
  idleT = 0;
  beginIdle() {
    this.running = false; this.over = false; this.paused = false;
    this.enemies.forEach((e) => { e.alive = false; e.g.visible = false; });
    this.pickups.forEach((p) => { this.scene.remove(p.mesh); this.scene.remove(p.label); });
    this.pickups = []; this.parts.length = 0;
    this.gunPivot.visible = false;
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }
  idleCam(dt: number) {
    this.idleT += dt;
    const a = this.idleT * 0.08;
    this.cam.position.set(Math.cos(a) * 44, 20 + Math.sin(a * 0.6) * 3.5, Math.sin(a) * 44);
    this.cam.rotation.set(0, 0, 0, "YXZ");
    this.cam.lookAt(0, 1.5, 0);
    if (this.cam.fov !== 72) { this.cam.fov = 72; this.cam.updateProjectionMatrix(); }
    this.updateParticles(dt);
  }

  loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.06) dt = 0.06;
    if (!this.running) { this.idleCam(dt); this.renderer.render(this.scene, this.cam); return; }
    if (!this.paused) this.update(dt);
    this.render();
  };

  update(dt: number) {
    if (!this.over) this.time += dt;
    const w = this.weapon;

    /* --- player input --- */
    const k = this.keys;
    const frozen = this.over || this.dead;
    let mf = 0, ms = 0;
    if (!frozen) {
      if (k[this.keyMap.forward] || k["ArrowUp"]) mf += 1;
      if (k[this.keyMap.backward] || k["ArrowDown"]) mf -= 1;
      if (k[this.keyMap.left] || k["ArrowLeft"]) ms -= 1;
      if (k[this.keyMap.right] || k["ArrowRight"]) ms += 1;
      mf += -this.touch.my; ms += this.touch.mx;
    }
    const mag = Math.hypot(mf, ms);
    if (mag > 1) { mf /= mag; ms /= mag; }

    this.sprinting = (!!k["ShiftLeft"] || !!k["ShiftRight"] || this.touch.sprint) && mf > 0.4 && !this.ads && !frozen;
    
    // Crouch and Slide Mechanics
    const crouchWant = (!!k[this.keyMap.crouch] || this.touch.crouch) && !frozen;
    
    // Initiate Slide
    if (crouchWant && !this.crouched && this.sprinting && this.grounded && !this.sliding) {
      this.sliding = true;
      this.slideT = 0.8;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      this.slideDir.set(-sin, 0, -cos).normalize();
      this.sfx.slide();
    }
    this.crouched = crouchWant;

    // Slide decay & friction physics
    if (this.sliding) {
      this.slideT -= dt;
      if (this.slideT <= 0 || !this.grounded) this.sliding = false;
    }

    const adsWant = (this.ads || this.touch.ads) && !frozen && this.reloadT <= 0;
    this.ads = adsWant;
    this.adsT += ((adsWant ? 1 : 0) - this.adsT) * Math.min(1, dt * 14);

    let speed = frozen ? 0 : (this.sprinting ? 9.1 : this.ads ? 3.5 : 6.4) * (this.grounded ? 1 : 0.9);
    if (this.crouched && !this.sliding) speed *= 0.5;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let wishX = (-sin * mf + cos * ms) * speed;
    let wishZ = (-cos * mf - sin * ms) * speed;

    if (this.sliding) {
      // Slidestream boost velocity overriding standard walking speed
      const slideBoost = 13.5 * Math.pow(this.slideT / 0.8, 1.4);
      wishX = this.slideDir.x * slideBoost;
      wishZ = this.slideDir.z * slideBoost;
    }

    const accel = this.grounded ? (this.sliding ? 5 : 14) : 4;
    this.vel.x += (wishX - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wishZ - this.vel.z) * Math.min(1, accel * dt);
    this.vel.y -= 23 * dt;

    if ((k[this.keyMap.jump] || this.touch.jump) && this.grounded && !frozen) {
      this.vel.y = 8.2;
      this.grounded = false;
      this.touch.jump = false;
      this.sliding = false;
      this.sfx.jump();
    } else if (this.touch.jump) this.touch.jump = false;

    const wasGrounded = this.grounded;
    this.grounded = this.moveEntity(this.pos, this.vel, dt, 0.34, 1.05);

    // Dynamic footstep sound synthesis
    if (this.grounded && !wasGrounded) {
      this.sfx.land("grass");
    }
    if (this.grounded && Math.hypot(this.vel.x, this.vel.z) > 1.2 && !this.sliding && !frozen) {
      this.bob += dt * (this.sprinting ? 13 : 9);
      if (Math.sin(this.bob) < -0.95 && this.time - this.lastStepT > 0.3) {
        this.sfx.footstep(this.pos.y > 1.2 ? "stone" : "grass");
        this.lastStepT = this.time;
      }
    }

    if (this.pos.y < -8) this.hurtPlayer(999);

    // head bob height modifications
    const hv = Math.hypot(this.vel.x, this.vel.z);
    this.bobAmt += (Math.min(1, hv / 7) * (this.grounded ? 1 : 0) - this.bobAmt) * Math.min(1, dt * 8);

    /* --- weapon --- */
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.swapT > 0) this.swapT -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { this.slotAmmo[this.cur] = w.mag; this.reloadT = 0; }
    }
    if ((this.firing || this.touch.fire) && !frozen && !this.paused) {
      if (w.auto) this.tryFire();
    }
    if (this.nadeCd > 0) this.nadeCd -= dt;
    if (this.touch.nade) { this.touch.nade = false; this.throwGrenade(); }
    this.updateLocalNades(dt);

    // multiplayer death / respawn (3s, full health)
    if (this.dead && this.respawnT > 0) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.respawnNow();
    }

    // recoil recovery
    this.recoilP *= Math.pow(0.0025, dt);
    this.recoilY *= Math.pow(0.0025, dt);
    this.kickV += -this.kick * 170 * dt - this.kickV * 13 * dt;
    this.kick += this.kickV * dt;
    this.gunRoll *= Math.pow(0.002, dt);
    this.shake *= Math.pow(0.0009, dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.hitmarkT = Math.max(0, this.hitmarkT - dt);
    this.flashT -= dt;
    if (this.flashT <= 0) { this.flash.intensity = 0; this.flashMesh.visible = false; }
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.toastT > 0) this.toastT -= dt;

    /* --- networking (prediction already applied above; now reconcile + replicate) --- */
    const netClient = !!(this.mp && this.mp.active && !this.mp.isHost);
    if (this.mp && this.mp.active) this.mp.update(dt);

    /* --- waves --- */
    if (!this.over && !netClient) this.updateWaves(dt);

    /* --- enemies --- */
    let alive = 0;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      alive++;
      if (netClient) this.updateEnemyRemote(e, dt); else this.updateEnemy(e, dt);
    }
    if (!netClient && this.waveState === "fight" && alive === 0 && this.spawnQ === 0) {
      this.waveState = "break";
      this.breakT = 5;
      const bonus = 250 * this.wave;
      this.score += bonus;
      this.setBanner(`WAVE ${this.wave} CLEAR`, `+${bonus} BONUS`);
      this.hp = Math.min(100, this.hp + 18);
      this.sfx.wave();
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * TAU;
        this.spawnPickup(new THREE.Vector3(this.pos.x + Math.cos(a) * 6, 0, this.pos.z + Math.sin(a) * 6), i === 0 ? 1 : Math.random() < 0.5 ? 0 : 2);
      }
    }

    /* --- pickups --- */
    for (const p of this.pickups) {
      if (!p.alive) continue;
      p.t += dt;
      p.mesh.rotation.y += dt * 2.2;
      p.mesh.position.y = this.hAt(p.mesh.position.x, p.mesh.position.z) + 0.6 + Math.sin(p.t * 3) * 0.14;
      p.label.position.copy(p.mesh.position).setY(p.mesh.position.y + 0.62);
      if (p.mesh.position.distanceTo(this.pos) < 1.5) {
        p.alive = false;
        this.scene.remove(p.mesh);
        this.scene.remove(p.label);
        this.sfx.pickup();
        if (p.kind === 0) { this.hp = Math.min(100, this.hp + 35); this.setToast("+35 HEALTH"); }
        else if (p.kind === 1) { this.slotAmmo = this.slots.map((s) => s.mag); this.setToast("AMMO REFILLED"); }
        else {
          const nw = WMAP[p.wid!];
          const idx = this.cur;
          this.slots[idx] = nw;
          this.slotAmmo[idx] = nw.mag;
          this.buildGun(nw);
          this.reloadT = 0; this.swapT = 0.3;
          this.setToast(`PICKED UP ${nw.name}`);
        }
        this.burst(p.mesh.position, 14, 0xffffff, 0.09, 4, 0.4);
      }
    }
    this.pickups = this.pickups.filter((p) => p.alive);

    this.updateParticles(dt);
    for (const t of this.tracers) {
      if (t.t > 0) {
        t.t -= dt;
        (t.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, t.t / 0.07) * 0.85;
        if (t.t <= 0) t.m.visible = false;
      }
    }
    this.pushHud();
  }

  private lastStepT = 0;

  updateWaves(dt: number) {
    if (this.waveState === "break") {
      this.breakT -= dt;
      if (this.breakT <= 0) {
        this.wave++;
        this.waveState = "fight";
        this.spawnQ = Math.min(28, 4 + Math.floor(this.wave * 2.2));
        this.spawnT = 0;
        this.setBanner(`WAVE ${this.wave}`, `${this.spawnQ} HOSTILES`);
        this.sfx.wave();
      }
    } else if (this.waveState === "fight" && this.spawnQ > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnEnemy();
        this.spawnQ--;
        this.spawnT = Math.max(0.22, 0.8 - this.wave * 0.04);
      }
    }
  }

  updateEnemy(e: Enemy, dt: number) {
    // co-op: hunt whichever player is closest (host runs the AI for everyone)
    let tPos = this.pos, tId = "";
    const hostAI = !!(this.mp && this.mp.active && this.mp.isHost);
    if (hostAI) {
      const other = this.mp!.nearestTarget(e.pos);
      if (other && (this.dead || other.pos.distanceTo(e.pos) < this.pos.distanceTo(e.pos))) { tPos = other.pos; tId = other.id; }
    }
    const to = new THREE.Vector3(tPos.x - e.pos.x, 0, tPos.z - e.pos.z);
    const dist = to.length();
    to.normalize();
    e.wobble += dt;

    // steering: strafe if blocked
    const ahead = new THREE.Vector3(e.pos.x + to.x * 0.9, e.pos.y, e.pos.z + to.z * 0.9);
    if (this.collide(ahead, 0.4, 1.15)) {
      e.strafe = e.strafe || (Math.random() < 0.5 ? -1 : 1);
      const side = new THREE.Vector3(-to.z, 0, to.x).multiplyScalar(e.strafe);
      to.add(side.multiplyScalar(1.5)).normalize();
      if (e.grounded && Math.random() < 0.06) e.vel.y = 7.5;
    } else e.strafe = 0;

    const sp = e.speed * (e.fuse >= 0 ? 1.5 : 1);
    const desiredX = to.x * sp + Math.sin(e.wobble * 2.2) * 0.5 * to.z;
    const desiredZ = to.z * sp - Math.sin(e.wobble * 2.2) * 0.5 * to.x;
    const acc = e.grounded ? 9 : 3;
    e.vel.x += (desiredX - e.vel.x) * Math.min(1, acc * dt);
    e.vel.z += (desiredZ - e.vel.z) * Math.min(1, acc * dt);
    e.vel.y -= 23 * dt;
    e.grounded = this.moveEntity(e.pos, e.vel, dt, 0.4, 1.15);

    // attack
    e.atkCd -= dt;
    const reach = e.armed ? 22.0 : 1.25 + e.scale * 0.4;
    
    if (e.type === 3) {
      if (dist < 2.4 && e.fuse < 0) e.fuse = 0.85;
      if (e.fuse >= 0) {
        e.fuse -= dt;
        const f = Math.sin(this.time * 40) * 0.5 + 0.5;
        e.mats[0].emissive.setRGB(f, f * 0.3, 0);
        e.g.scale.setScalar(e.scale * (1 + f * 0.14));
        if (e.fuse <= 0) {
          e.alive = false; e.g.visible = false;
          this.explode(e.pos.clone().setY(e.pos.y + 0.8), 4.2, e.dmg, 0x35d97a);
        }
      }
    } else if (dist < reach && e.atkCd <= 0) {
      e.atkCd = e.armed ? 1.8 : 1.05;
      if (e.armed) {
        // AI weapon discharge! Spawn physical bullet tracer firing back
        const start = e.pos.clone().setY(e.pos.y + 1.2);
        const end = tPos.clone().setY(tPos.y + 0.6);
        this.spawnTracer(start, end, 0xff5e5e);
        if (tId) this.mp!.onPlayerHit(tId, e.dmg, false);
        else this.hurtPlayer(e.dmg);
        this.sfx.remoteShot(140, 0.25, dist, false);
      } else {
        if (tId) this.mp!.onPlayerHit(tId, e.dmg, false);
        else this.hurtPlayer(e.dmg);
      }
      e.vel.addScaledVector(to, -3);
    }

    // visuals
    e.g.position.copy(e.pos);
    e.g.rotation.y = Math.atan2(to.x, to.z);
    const hv = Math.hypot(e.vel.x, e.vel.z);
    e.anim += dt * (2 + hv * 2.4);
    const sw = Math.sin(e.anim * 2.4) * clamp(hv / 3, 0.2, 1.3);
    const ch = e.g.children;
    (ch[6] as THREE.Mesh).rotation.x = sw;         // legL
    (ch[7] as THREE.Mesh).rotation.x = -sw;        // legR
    (ch[4] as THREE.Mesh).rotation.x = -sw * 0.7 - 1.1;  // armL forward
    (ch[5] as THREE.Mesh).rotation.x = sw * 0.7 - 1.1;
    (ch[0] as THREE.Mesh).position.y = 1.5 + Math.sin(e.anim * 4.8) * 0.03;
    if (e.flash > 0) {
      e.flash -= dt;
      const on = e.flash > 0;
      e.mats[0].emissive.setHex(on ? 0xff5555 : 0x000000);
      e.mats[1].emissive.setHex(on ? 0x992222 : 0x000000);
      if (!on && e.type !== 3) { e.mats[0].emissive.setHex(0x000000); e.mats[1].emissive.setHex(0x000000); }
    }
    if (e.hitT > 0) { e.hitT -= dt; e.g.scale.setScalar(e.scale * (1 + e.hitT * 0.6)); }
    else if (e.fuse < 0) e.g.scale.setScalar(e.scale);
  }

  updateParticles(dt: number) {
    const d = this.dummy;
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.v.y -= p.grav * dt;
      p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.p.addScaledVector(p.v, dt);
      const g = this.hAt(p.p.x, p.p.z);
      if (p.p.y < g + p.size * 0.5) { p.p.y = g + p.size * 0.5; p.v.y *= -0.34; p.v.x *= 0.7; p.v.z *= 0.7; }
      p.rot += p.spin * dt;
      const k = clamp(p.life / p.max, 0, 1);
      d.position.copy(p.p);
      d.rotation.set(p.rot, p.rot * 0.7, 0);
      d.scale.setScalar(p.size * (0.35 + k * 0.65));
      d.updateMatrix();
      this.pMesh.setMatrixAt(n, d.matrix);
      this.pMesh.setColorAt(n, p.col);
      n++;
      if (n >= 800) break;
    }
    this.pMesh.count = n;
    this.pMesh.instanceMatrix.needsUpdate = true;
    if (this.pMesh.instanceColor) this.pMesh.instanceColor.needsUpdate = true;
  }

  /* ---------------- render ---------------- */
  render() {
    const w = this.weapon;
    const zoom = w ? 1 + (w.zoom - 1) * this.adsT : 1;
    const targetFov = 78 / zoom;
    this.cam.fov += (targetFov - this.cam.fov) * 0.25;
    this.cam.updateProjectionMatrix();

    const bobX = Math.sin(this.bob) * 0.045 * this.bobAmt * (1 - this.adsT * 0.7);
    const bobY = Math.abs(Math.cos(this.bob)) * 0.05 * this.bobAmt * (1 - this.adsT * 0.7);
    const sh = this.shake;
    this.shakeV.set(rand(-1, 1) * sh * 0.09, rand(-1, 1) * sh * 0.09, rand(-1, 1) * sh * 0.05);
    
    // Smooth camera height during crouch / slide
    const targetEye = this.crouched ? 0.85 : 1.62;
    this.crouchT += (targetEye - this.crouchT) * Math.min(1.0, 15 * (1 / 60)); // smooth height dip
    const eye = this.crouchT + (this.over ? -1.0 : this.dead ? -0.85 : 0);

    if (Math.abs(this.pos.y - this.viewY) > 1.6) this.viewY = this.pos.y;
    else this.viewY += (this.pos.y - this.viewY) * 0.28;
    this.cam.position.set(this.pos.x + bobX + this.shakeV.x, this.viewY + eye + bobY + this.shakeV.y, this.pos.z + this.shakeV.z);
    this.cam.rotation.set(0, 0, 0, "YXZ");
    this.cam.rotation.order = "YXZ";
    this.cam.rotation.y = this.yaw + this.recoilY + this.shakeV.z * 0.1;
    this.cam.rotation.x = clamp(this.pitch + this.recoilP, -1.55, 1.55);
    this.cam.rotation.z = Math.sin(this.bob * 0.5) * 0.012 * this.bobAmt + this.gunRoll * 0.3 + sh * rand(-0.01, 0.01);
    this.cam.updateMatrixWorld();

    // viewmodel placement
    const sway = clamp(this.recoilY * 6, -0.1, 0.1);
    const hip = new THREE.Vector3(0.22, -0.19, -0.42);
    const aim = new THREE.Vector3(0, -0.105, -0.3);
    const scoped = w && w.zoom > 2.6;
    const a = this.adsT;
    const gp = this.gunPivot.position;
    gp.set(
      hip.x + (aim.x - hip.x) * a - sway,
      hip.y + (aim.y - hip.y) * a - bobY * 0.6 - this.kick * 0.09,
      hip.z + (aim.z - hip.z) * a + this.kick * 0.62
    );
    const swapDip = this.swapT > 0 ? Math.sin((1 - this.swapT / 0.42) * Math.PI) : 0;
    const reloadP = this.reloadT > 0 ? Math.sin((1 - this.reloadT / this.reloadDur) * Math.PI) : 0;
    gp.y -= swapDip * 0.4 + reloadP * 0.26;
    gp.x += bobX * 0.5 * (1 - a);
    this.gunPivot.rotation.set(
      this.kick * 0.55 + reloadP * 0.6 + swapDip * 0.5,
      -sway * 2 + Math.sin(this.bob * 0.5) * 0.02 * this.bobAmt * (1 - a),
      this.gunRoll + reloadP * 0.5 - a * 0.02
    );
    this.gunGroup.visible = !(scoped && a > 0.7);
    this.gunGroup.scale.setScalar(1 - a * 0.06);

    // projecting floating labels / names perfectly
    const rect = this.canvas.getBoundingClientRect();
    for (const d of this.dmgPool) {
      if (d.t <= 0) { if (d.el.style.opacity !== "0") d.el.style.opacity = "0"; continue; }
      d.t -= 1 / 60;
      const k = d.t / d.life;
      const v = d.p.clone();
      v.y += (1 - k) * 0.9;
      v.project(this.cam);
      if (v.z > 1) { d.el.style.opacity = "0"; continue; }
      const x = (v.x * 0.5 + 0.5) * rect.width;
      const y = (-v.y * 0.5 + 0.5) * rect.height;
      d.el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px) scale(${0.8 + k * 0.5})`;
      d.el.style.opacity = String(clamp(k * 1.6, 0, 1));
    }

    this.renderer.render(this.scene, this.cam);
    if (this.gunPivot.visible) {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.gunScene, this.gunCam);
      this.renderer.autoClear = true;
    }
  }

  /* ---------------- hud ---------------- */
  hud(): HudState {
    const w = this.weapon;
    const other = this.slots[this.cur === 0 ? 1 : 0];
    return {
      hp: Math.round(this.hp), armor: Math.round(this.armor),
      ammo: this.slotAmmo[this.cur] ?? 0, mag: w?.mag ?? 0,
      reloading: this.reloadT > 0, reloadPct: this.reloadT > 0 ? 1 - this.reloadT / this.reloadDur : 0,
      wid: w?.id ?? "", wname: w?.name ?? "", wcls: w?.cls ?? "",
      otherName: other?.name ?? "", otherAmmo: this.slotAmmo[this.cur === 0 ? 1 : 0] ?? 0, otherMag: other?.mag ?? 0,
      score: this.score, combo: this.combo, comboPct: clamp(this.comboT / 3.6, 0, 1), mult: this.mult(),
      wave: Math.max(1, this.wave), alive: this.enemies.filter((e) => e.alive).length + this.spawnQ, kills: this.kills,
      ads: this.adsT > 0.5, zoom: w?.zoom ?? 1, spread: (this.ads ? (w?.adsSpread ?? 1) : (w?.spread ?? 1)) * (this.sprinting ? 1.7 : 1),
      sprint: this.sprinting, banner: this.bannerT > 0 ? this.banner : "", bannerSub: this.bannerT > 0 ? this.bannerSub : "",
      toast: this.toastT > 0 ? this.toast : "", feed: this.feed, hurt: this.hurtT, grounded: this.grounded,
      hitmark: this.hitmarkT > 0 ? (this.hitmarkCrit ? 2 : 1) : 0,
      nades: this.nades, dead: this.dead, respawnT: this.respawnT,
      mp: !!(this.mp && this.mp.active), pvp: this.pvp,
      crouched: this.crouched, sliding: this.sliding,
    };
  }
  pushHud() {
    const h = this.hud();
    const sig = `${h.hp}|${h.ammo}|${h.reloading}|${Math.round(h.reloadPct * 20)}|${h.score}|${h.combo}|${h.wave}|${h.alive}|${h.wid}|${h.banner}|${h.toast}|${h.feed[0]?.id ?? -1}|${h.ads}|${Math.round(h.spread * 10)}|${h.sprint}|${Math.round(this.hitmarkT * 30)}|${Math.round(h.hurt * 10)}|${h.nades}|${h.dead}|${Math.ceil(h.respawnT)}|${h.crouched}|${h.sliding}`;
    if (sig !== this.hudSig) { this.hudSig = sig; this.cb.onHud(h); }
  }
}
export { buildParts };
export { buildParts as buildPartsVoxel };
export type { Attachments, WClass };
