import * as THREE from "three";
import type { Game } from "./engine";
import { Net, type NetPlayer, type RoomMeta } from "../net/net";
import { WEAPONS, WMAP } from "./weapons";

const LERP_DELAY = 0.11;     // seconds of interpolation buffer
const PS_RATE = 1 / 16;      // player snapshot rate
const ES_RATE = 1 / 12;      // enemy snapshot rate (host only)
const TEAM_COLORS = [0x4dd2ff, 0xffc23f, 0xff7a9c, 0x9cff6a, 0xc58cff, 0xff8a3d, 0x6affd2, 0xf0f0f0, 0xff5e5e];

interface Snap { t: number; x: number; y: number; z: number; ry: number; rx: number }

interface Remote {
  id: string;
  g: THREE.Group;
  parts: { head: THREE.Mesh; torso: THREE.Mesh; armL: THREE.Mesh; armR: THREE.Mesh; legL: THREE.Mesh; legR: THREE.Mesh; gun: THREE.Mesh };
  tag: THREE.Sprite;
  buf: Snap[];
  hp: number;
  dead: boolean;
  anim: number;
  last: number;
  pos: THREE.Vector3;
  yaw: number;
  wid: string;
  flash: number;
}

interface Nade { p: THREE.Vector3; v: THREE.Vector3; fuse: number; mesh: THREE.Mesh; mine: boolean }

export class MP {
  game: Game;
  net: Net;
  active = true;
  isHost = false;
  pvp = false;
  myId = "";
  remotes = new Map<string, Remote>();
  nades: Nade[] = [];
  private psT = 0;
  private esT = 0;
  private scT = 0;
  private nadeGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  private nadeMat = new THREE.MeshLambertMaterial({ color: 0x2f4a2a, emissive: 0x143d18, emissiveIntensity: 0.4 });
  onRosterDirty: () => void = () => {};

  constructor(game: Game, net: Net) {
    this.game = game;
    this.net = net;
    this.isHost = net.isHost;
    this.myId = net.id;
    this.pvp = net.meta.pvp;
  }

  /* ------------------------------------------------- avatars ------------------------------------------------ */
  private colorFor(id: string) {
    const list = this.net.playerList;
    const i = Math.max(0, list.findIndex((p) => p.id === id));
    return TEAM_COLORS[i % TEAM_COLORS.length];
  }

  private makeTag(name: string, color: number) {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 64;
    const x = c.getContext("2d")!;
    x.fillStyle = "rgba(6,10,14,0.72)";
    x.fillRect(0, 8, 256, 48);
    x.strokeStyle = "#" + color.toString(16).padStart(6, "0");
    x.lineWidth = 4;
    x.strokeRect(2, 10, 252, 44);
    x.font = "bold 30px ui-monospace, monospace";
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillStyle = "#fff";
    x.fillText(name.slice(0, 12), 128, 33);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    s.scale.set(1.5, 0.38, 1);
    s.position.y = 2.35;
    s.renderOrder = 999;
    return s;
  }

  private addRemote(p: NetPlayer): Remote {
    const color = this.colorFor(p.id);
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color });
    const kit = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.45).getHex() });
    const dark = new THREE.MeshLambertMaterial({ color: 0x232a33 });
    const mk = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, pivotTop = false) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      if (pivotTop) geo.translate(0, -h / 2, 0);
      const me = new THREE.Mesh(geo, m);
      me.position.set(x, y, z);
      g.add(me);
      return me;
    };
    const head = mk(0.52, 0.52, 0.52, 0, 1.55, 0, skin);
    mk(0.4, 0.12, 0.04, 0, 1.6, -0.27, dark);
    const torso = mk(0.66, 0.68, 0.36, 0, 1.0, 0, kit);
    const armL = mk(0.18, 0.6, 0.2, -0.42, 1.3, 0, skin, true);
    const armR = mk(0.18, 0.6, 0.2, 0.42, 1.3, 0, skin, true);
    const legL = mk(0.22, 0.66, 0.24, -0.16, 0.66, 0, dark, true);
    const legR = mk(0.22, 0.66, 0.24, 0.16, 0.66, 0, dark, true);
    const gun = mk(0.12, 0.14, 0.85, 0.3, 1.2, -0.45, new THREE.MeshLambertMaterial({ color: 0x23282f }));
    const tag = this.makeTag(p.name, color);
    g.add(tag);
    g.visible = false;
    this.game.scene.add(g);
    const r: Remote = {
      id: p.id, g, parts: { head, torso, armL, armR, legL, legR, gun }, tag,
      buf: [], hp: 100, dead: false, anim: 0, last: 0,
      pos: new THREE.Vector3(), yaw: 0, wid: WEAPONS[0].id, flash: 0,
    };
    this.remotes.set(p.id, r);
    return r;
  }

  syncRoster() {
    for (const p of this.net.playerList) {
      if (p.id === this.myId) continue;
      if (!this.remotes.has(p.id)) this.addRemote(p);
    }
    for (const [id, r] of this.remotes) {
      if (!this.net.players.has(id) || id === this.myId) { this.game.scene.remove(r.g); this.remotes.delete(id); }
    }
    this.onRosterDirty();
  }

  onIdChanged(newId: string) {
    this.myId = newId;
    this.isHost = this.net.isHost;
    const mine = this.remotes.get(newId);
    if (mine) { this.game.scene.remove(mine.g); this.remotes.delete(newId); }
    this.syncRoster();
  }

  dispose() {
    for (const r of this.remotes.values()) this.game.scene.remove(r.g);
    this.remotes.clear();
    for (const n of this.nades) this.game.scene.remove(n.mesh);
    this.nades = [];
    this.active = false;
  }

  /* -------------------------------------------------- send -------------------------------------------------- */
  private r2 = (v: number) => Math.round(v * 100) / 100;

  private sendPlayerState() {
    const g = this.game;
    this.net.send({
      t: "ps",
      x: this.r2(g.pos.x), y: this.r2(g.pos.y), z: this.r2(g.pos.z),
      ry: this.r2(g.yaw), rx: this.r2(g.pitch),
      hp: Math.round(g.hp), w: g.slots[g.cur]?.id ?? "", d: g.dead ? 1 : 0,
    });
  }

  onFire(origin: THREE.Vector3, end: THREE.Vector3, wid: string) {
    this.net.send({
      t: "sh", ox: this.r2(origin.x), oy: this.r2(origin.y), oz: this.r2(origin.z),
      ex: this.r2(end.x), ey: this.r2(end.y), ez: this.r2(end.z), w: wid,
    });
  }
  onEnemyHit(idx: number, dmg: number, head: boolean) {
    if (this.isHost) return; // host applies directly
    this.net.sendTo(this.net.hostId, { t: "eh", i: idx, d: Math.round(dmg), h: head ? 1 : 0 });
  }
  onEnemyKill(idx: number, by: string, head: boolean, score: number) {
    if (!this.isHost) return;
    this.net.send({ t: "ek", i: idx, by, h: head ? 1 : 0, s: score });
  }
  onPlayerHit(target: string, dmg: number, head: boolean) {
    this.net.sendTo(target, { t: "pd", d: Math.round(dmg), h: head ? 1 : 0 });
  }
  onDeath(by: string) {
    this.net.send({ t: "dead", by });
  }
  onRespawn(p: THREE.Vector3) {
    this.net.send({ t: "resp", x: this.r2(p.x), y: this.r2(p.y), z: this.r2(p.z) });
  }
  onGrenade(p: THREE.Vector3, v: THREE.Vector3) {
    this.net.send({ t: "nade", x: this.r2(p.x), y: this.r2(p.y), z: this.r2(p.z), vx: this.r2(v.x), vy: this.r2(v.y), vz: this.r2(v.z) });
  }

  private sendEnemySnapshot() {
    const g = this.game;
    const arr: number[] = [];
    for (let i = 0; i < g.enemies.length; i++) {
      const e = g.enemies[i];
      if (!e.alive) continue;
      arr.push(i, e.type, this.r2(e.pos.x), this.r2(e.pos.y), this.r2(e.pos.z),
        this.r2(e.g.rotation.y), Math.round(e.hp), Math.round(e.maxHp), e.fuse >= 0 ? 1 : 0);
    }
    this.net.send({ t: "es", w: g.wave, q: g.spawnQ, ws: g.waveState, e: arr });
  }

  /* ------------------------------------------------- receive ------------------------------------------------ */
  handle(m: Record<string, unknown>, from: string) {
    const g = this.game;
    switch (m.t) {
      case "ps": {
        let r = this.remotes.get(from);
        if (!r) { const p = this.net.players.get(from); if (!p) return; r = this.addRemote(p); }
        const now = performance.now() / 1000;
        r.buf.push({ t: now, x: +(m.x as number), y: +(m.y as number), z: +(m.z as number), ry: +(m.ry as number), rx: +(m.rx as number) });
        if (r.buf.length > 12) r.buf.shift();
        r.hp = +(m.hp as number);
        r.dead = m.d === 1;
        r.wid = String(m.w || r.wid);
        r.last = now;
        break;
      }
      case "sh": {
        const o = new THREE.Vector3(+(m.ox as number), +(m.oy as number), +(m.oz as number));
        const e = new THREE.Vector3(+(m.ex as number), +(m.ey as number), +(m.ez as number));
        const w = WMAP[String(m.w)] ?? WEAPONS[0];
        g.spawnTracer(o, e, w.tracer);
        g.burst(e, 5, 0xd7cdb6, 0.08, 2.6, 0.3);
        const rr = this.remotes.get(from);
        if (rr) rr.flash = 0.05;
        const dist = g.pos.distanceTo(o);
        if (dist < 46) g.sfx.remoteShot(w.tone, w.boom, dist, w.quiet);
        break;
      }
      case "eh": {
        if (!this.isHost) return;
        const e = g.enemies[+(m.i as number)];
        if (e && e.alive) g.applyEnemyDamage(e, +(m.d as number), m.h === 1, from);
        break;
      }
      case "ek": {
        const idx = +(m.i as number);
        const e = g.enemies[idx];
        if (e && e.alive) g.netKillEnemy(e, m.h === 1, String(m.by) === this.myId ? +(m.s as number) : 0, String(m.by) === this.myId);
        break;
      }
      case "es": {
        if (this.isHost) return;
        g.applyEnemySnapshot(m.e as number[], +(m.w as number), +(m.q as number), String(m.ws) as "idle" | "break" | "fight");
        break;
      }
      case "pd": {
        if (!this.pvp || g.dead) return;
        g.hurtPlayer(+(m.d as number), from);
        break;
      }
      case "dead": {
        const r = this.remotes.get(from);
        if (r) { r.dead = true; r.g.visible = false; }
        const who = this.net.players.get(from)?.name ?? "PLAYER";
        const by = this.net.players.get(String(m.by))?.name;
        g.addFeed(by ? `${by} ELIMINATED ${who}` : `${who} WAS KILLED`, String(m.by) === this.myId);
        break;
      }
      case "resp": {
        const r = this.remotes.get(from);
        if (r) { r.dead = false; r.hp = 100; r.buf.length = 0; }
        break;
      }
      case "nade": {
        this.spawnNade(
          new THREE.Vector3(+(m.x as number), +(m.y as number), +(m.z as number)),
          new THREE.Vector3(+(m.vx as number), +(m.vy as number), +(m.vz as number)), false);
        break;
      }
      case "sc": {
        this.net.setStat(from, +(m.s as number), +(m.k as number));
        this.onRosterDirty();
        break;
      }
      case "wave": {
        if (this.isHost) return;
        g.setBanner(String(m.a), String(m.b));
        g.sfx.wave();
        break;
      }
    }
  }

  /* ------------------------------------------------ grenades ------------------------------------------------ */
  spawnNade(p: THREE.Vector3, v: THREE.Vector3, mine: boolean) {
    const mesh = new THREE.Mesh(this.nadeGeo, this.nadeMat);
    mesh.position.copy(p);
    this.game.scene.add(mesh);
    this.nades.push({ p: p.clone(), v: v.clone(), fuse: 1.6, mesh, mine });
    if (this.nades.length > 14) {
      const old = this.nades.shift()!;
      this.game.scene.remove(old.mesh);
    }
  }

  private updateNades(dt: number) {
    const g = this.game;
    for (let i = this.nades.length - 1; i >= 0; i--) {
      const n = this.nades[i];
      n.fuse -= dt;
      n.v.y -= 22 * dt;
      const next = n.p.clone().addScaledVector(n.v, dt);
      const gh = g.hAt(next.x, next.z);
      if (next.y < gh + 0.11) { next.y = gh + 0.11; n.v.y = Math.abs(n.v.y) * 0.42; n.v.x *= 0.7; n.v.z *= 0.7; }
      n.p.copy(next);
      n.mesh.position.copy(n.p);
      n.mesh.rotation.x += dt * 6; n.mesh.rotation.z += dt * 4;
      if (n.fuse <= 0) {
        g.scene.remove(n.mesh);
        this.nades.splice(i, 1);
        g.grenadeBlast(n.p.clone(), this.isHost, n.mine ? this.myId : "");
      }
    }
  }

  /* ------------------------------------------------- update ------------------------------------------------- */
  update(dt: number) {
    const g = this.game;
    this.pvp = this.net.meta.pvp;
    this.isHost = this.net.isHost;

    this.psT -= dt;
    if (this.psT <= 0) { this.psT = PS_RATE; this.sendPlayerState(); }
    if (this.isHost) {
      this.esT -= dt;
      if (this.esT <= 0) { this.esT = ES_RATE; this.sendEnemySnapshot(); }
    }
    this.scT -= dt;
    if (this.scT <= 0) {
      this.scT = 1.2;
      this.net.send({ t: "sc", s: g.score, k: g.kills });
      this.net.setStat(this.myId, g.score, g.kills);
      this.onRosterDirty();
    }

    this.updateNades(dt);

    // interpolate remote players
    const now = performance.now() / 1000;
    const rt = now - LERP_DELAY;
    for (const r of this.remotes.values()) {
      if (r.buf.length === 0) { r.g.visible = false; continue; }
      let a = r.buf[0], b = r.buf[r.buf.length - 1];
      for (let i = 0; i < r.buf.length - 1; i++) {
        if (r.buf[i].t <= rt && r.buf[i + 1].t >= rt) { a = r.buf[i]; b = r.buf[i + 1]; break; }
      }
      const span = Math.max(1e-4, b.t - a.t);
      const k = Math.max(0, Math.min(1, (rt - a.t) / span));
      const px = a.x + (b.x - a.x) * k;
      const py = a.y + (b.y - a.y) * k;
      const pz = a.z + (b.z - a.z) * k;
      let dy = b.ry - a.ry;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      const ry = a.ry + dy * k;
      const moved = Math.hypot(px - r.pos.x, pz - r.pos.z) / Math.max(dt, 1e-3);
      r.pos.set(px, py, pz);
      r.yaw = ry;
      r.g.position.set(px, py, pz);
      r.g.rotation.y = ry + Math.PI;
      const stale = now - r.last > 3;
      r.g.visible = !r.dead && !stale;
      // walk animation
      r.anim += dt * (2 + Math.min(12, moved * 1.6));
      const sw = Math.sin(r.anim * 2.2) * Math.min(1.2, moved * 0.22);
      r.parts.legL.rotation.x = sw;
      r.parts.legR.rotation.x = -sw;
      r.parts.armL.rotation.x = -1.05 - sw * 0.4;
      r.parts.armR.rotation.x = -1.05 + sw * 0.4;
      r.parts.head.rotation.x = -(b.rx + (a.rx - b.rx) * (1 - k)) * 0.6;
      r.parts.gun.rotation.x = -(b.rx) * 0.5;
      if (r.flash > 0) {
        r.flash -= dt;
        (r.parts.gun.material as THREE.MeshLambertMaterial).emissive.setHex(r.flash > 0 ? 0xffcc55 : 0x000000);
      }
      // face camera for the tag
      r.tag.material.opacity = g.pos.distanceTo(r.pos) > 60 ? 0 : 1;
    }
  }

  /** Nearest live remote player — lets host-side AI hunt everyone, not just the host. */
  nearestTarget(from: THREE.Vector3) {
    let best: { id: string; pos: THREE.Vector3 } | null = null;
    let bd = Infinity;
    for (const r of this.remotes.values()) {
      if (r.dead || !r.g.visible) continue;
      const d = r.pos.distanceTo(from);
      if (d < bd) { bd = d; best = { id: r.id, pos: r.pos }; }
    }
    return best;
  }

  /** Remote players inside a blast radius. */
  playersInRadius(p: THREE.Vector3, radius: number) {
    const out: { id: string; dist: number }[] = [];
    for (const r of this.remotes.values()) {
      if (r.dead) continue;
      const d = r.pos.distanceTo(p);
      if (d < radius) out.push({ id: r.id, dist: d });
    }
    return out;
  }

  /** PvP hit test — returns closest player hit in front of the ray. */
  hitPlayers(origin: THREE.Vector3, dir: THREE.Vector3, maxT: number) {
    if (!this.pvp) return null;
    let best: { id: string; t: number; head: boolean; point: THREE.Vector3 } | null = null;
    for (const r of this.remotes.values()) {
      if (r.dead || !r.g.visible) continue;
      const hc = new THREE.Vector3(r.pos.x, r.pos.y + 1.55, r.pos.z);
      const bc = new THREE.Vector3(r.pos.x, r.pos.y + 0.95, r.pos.z);
      const th = this.game.rayBox(origin, dir, hc, 0.3, 0.3, 0.3);
      const tb = this.game.rayBox(origin, dir, bc, 0.42, 0.68, 0.34);
      let t = -1, head = false;
      if (th >= 0 && (tb < 0 || th <= tb)) { t = th; head = true; }
      else if (tb >= 0) { t = tb; head = false; }
      if (t >= 0 && t < maxT && (!best || t < best.t))
        best = { id: r.id, t, head, point: origin.clone().addScaledVector(dir, t) };
    }
    return best;
  }

  scoreboard(): { name: string; score: number; kills: number; host: boolean; me: boolean; alive: boolean }[] {
    return this.net.playerList.map((p) => ({
      name: p.name, score: p.id === this.myId ? this.game.score : p.score,
      kills: p.id === this.myId ? this.game.kills : p.kills,
      host: p.id === this.net.hostId, me: p.id === this.myId,
      alive: p.id === this.myId ? !this.game.dead : !(this.remotes.get(p.id)?.dead),
    }));
  }

  meta(): RoomMeta { return this.net.meta; }
}
