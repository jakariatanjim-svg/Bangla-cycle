import Peer, { type DataConnection } from "peerjs";

/**
 * Peer-to-peer room layer (star topology, host relays).
 * Supports automatic HOST MIGRATION: if the host drops, the remaining players
 * deterministically elect a new host (lowest join order) who re-claims the room
 * id on the broker; everyone else reconnects. The room never closes.
 */

export const PREFIX = "blkfrntv1-";
export const roomPeerId = (code: string) => PREFIX + code.toUpperCase();

export interface NetPlayer {
  id: string;
  name: string;
  order: number;      // join order — drives host election
  host: boolean;
  alive: boolean;
  score: number;
  kills: number;
  hp: number;
  ping: number;
}

export interface RoomMeta {
  code: string;
  maxPlayers: number;
  pvp: boolean;
  started: boolean;
  wave: number;
}

export type NetStatus =
  | "idle" | "creating" | "hosting" | "joining" | "connected"
  | "migrating" | "closed" | "error";

type Msg = Record<string, unknown> & { t: string; f?: string; to?: string };

export interface NetEvents {
  onStatus: (s: NetStatus, info?: string) => void;
  onRoster: (players: NetPlayer[], meta: RoomMeta) => void;
  onMessage: (m: Msg, from: string) => void;
  onHostChanged: (hostId: string, iAmHost: boolean) => void;
  onPlayerJoin: (p: NetPlayer) => void;
  onPlayerLeave: (id: string) => void;
  onError: (msg: string) => void;
}

export class Net {
  peer: Peer | null = null;
  conns = new Map<string, DataConnection>();  // host: clients | client: [host]
  hostConn: DataConnection | null = null;

  id = "";
  code = "";
  isHost = false;
  active = false;
  status: NetStatus = "idle";
  players = new Map<string, NetPlayer>();
  meta: RoomMeta = { code: "", maxPlayers: 10, pvp: false, started: false, wave: 1 };
  myName = "PLAYER";
  hostId = "";

  private orderSeq = 0;
  private migrating = false;
  private rejoinTimer: number | null = null;
  private rejoinTries = 0;
  private destroyed = false;
  private ev: NetEvents;

  constructor(ev: NetEvents) { this.ev = ev; }

  private setStatus(s: NetStatus, info?: string) { this.status = s; this.ev.onStatus(s, info); }
  private roster() { this.ev.onRoster([...this.players.values()].sort((a, b) => a.order - b.order), this.meta); }

  get playerList() { return [...this.players.values()].sort((a, b) => a.order - b.order); }
  get count() { return this.players.size; }

  /* ------------------------------------------------ host ------------------------------------------------ */
  createRoom(code: string, name: string, maxPlayers: number, pvp: boolean) {
    this.code = code.toUpperCase();
    this.myName = name;
    this.meta = { code: this.code, maxPlayers, pvp, started: false, wave: 1 };
    this.destroyed = false;
    this.setStatus("creating");
    this.spawnHostPeer(true);
  }

  private spawnHostPeer(fresh: boolean) {
    try { this.peer?.destroy(); } catch { /* ignore */ }
    const p = new Peer(roomPeerId(this.code), { debug: 0 });
    this.peer = p;
    p.on("open", (id) => {
      this.id = id;
      this.isHost = true;
      this.hostId = id;
      this.active = true;
      this.migrating = false;
      if (fresh) {
        this.orderSeq = 0;
        this.players.clear();
        this.addPlayer(id, this.myName, 0, true);
      } else {
        // migration: keep known roster, promote self
        const me = this.players.get(this.oldSelfId || id);
        this.players.delete(this.oldSelfId || "");
        this.addPlayer(id, this.myName, me?.order ?? 0, true);
        for (const pl of this.players.values()) pl.host = pl.id === id;
      }
      this.setStatus("hosting");
      this.ev.onHostChanged(id, true);
      this.roster();
      this.broadcast({ t: "hostmigrated", host: id, roster: this.serializeRoster(), meta: this.meta });
    });
    p.on("connection", (c) => this.acceptClient(c));
    p.on("error", (e: Error & { type?: string }) => {
      if (e.type === "unavailable-id") {
        if (this.migrating) { this.fallbackToJoin(); return; }
        this.ev.onError("Room code already in use — try another.");
        this.setStatus("error", "taken");
      } else if (e.type === "peer-unavailable") {
        /* handled on join */
      } else {
        this.ev.onError(e.message || "Network error");
      }
    });
    p.on("disconnected", () => { if (!this.destroyed) { try { p.reconnect(); } catch { /* ignore */ } } });
  }

  private acceptClient(c: DataConnection) {
    if (this.players.size >= this.meta.maxPlayers) {
      c.on("open", () => { c.send({ t: "full" }); setTimeout(() => c.close(), 200); });
      return;
    }
    c.on("open", () => {
      this.conns.set(c.peer, c);
      const meta = c.metadata as { name?: string } | undefined;
      const nm = (meta?.name || "PLAYER").slice(0, 12).toUpperCase();
      if (!this.players.has(c.peer)) this.addPlayer(c.peer, nm, ++this.orderSeq, false);
      c.send({ t: "welcome", you: c.peer, host: this.id, roster: this.serializeRoster(), meta: this.meta });
      this.broadcast({ t: "roster", roster: this.serializeRoster(), meta: this.meta });
      this.roster();
      this.ev.onPlayerJoin(this.players.get(c.peer)!);
    });
    c.on("data", (raw) => this.hostReceive(raw as Msg, c.peer));
    const gone = () => {
      if (!this.conns.has(c.peer)) return;
      this.conns.delete(c.peer);
      this.players.delete(c.peer);
      this.ev.onPlayerLeave(c.peer);
      this.broadcast({ t: "roster", roster: this.serializeRoster(), meta: this.meta });
      this.roster();
    };
    c.on("close", gone);
    c.on("error", gone);
  }

  private hostReceive(m: Msg, from: string) {
    if (!m || typeof m.t !== "string") return;
    m.f = from;
    if (m.t === "hello") {
      const pl = this.players.get(from);
      if (pl && typeof m.name === "string") pl.name = String(m.name).slice(0, 12).toUpperCase();
      this.broadcast({ t: "roster", roster: this.serializeRoster(), meta: this.meta });
      this.roster();
      return;
    }
    if (m.t === "ping") { this.conns.get(from)?.send({ t: "pong", ts: m.ts }); return; }
    // relay to everyone else (unless directed)
    if (m.to) {
      if (m.to === this.id) this.ev.onMessage(m, from);
      else this.conns.get(String(m.to))?.send(m);
    } else {
      for (const [pid, c] of this.conns) if (pid !== from) { try { c.send(m); } catch { /* ignore */ } }
      this.ev.onMessage(m, from);
    }
  }

  /* ----------------------------------------------- client ----------------------------------------------- */
  joinRoom(code: string, name: string) {
    this.code = code.toUpperCase();
    this.myName = name;
    this.destroyed = false;
    this.isHost = false;
    this.setStatus("joining");
    try { this.peer?.destroy(); } catch { /* ignore */ }
    const p = new Peer({ debug: 0 });
    this.peer = p;
    p.on("open", (id) => { this.id = id; this.connectToHost(); });
    p.on("error", (e: Error & { type?: string }) => {
      if (e.type === "peer-unavailable") {
        if (this.migrating || this.active) this.scheduleRejoin();
        else { this.ev.onError("Room not found. Check the code."); this.setStatus("error", "notfound"); }
      } else if (!this.destroyed) this.ev.onError(e.message || "Network error");
    });
    p.on("disconnected", () => { if (!this.destroyed) { try { p.reconnect(); } catch { /* ignore */ } } });
  }

  private connectToHost() {
    if (!this.peer || this.destroyed) return;
    const c = this.peer.connect(roomPeerId(this.code), {
      reliable: true, metadata: { name: this.myName },
    });
    let opened = false;
    c.on("open", () => {
      opened = true;
      this.rejoinTries = 0;
      this.hostConn = c;
      this.conns.clear();
      this.conns.set(c.peer, c);
      this.active = true;
      this.migrating = false;
      this.setStatus("connected");
      c.send({ t: "hello", name: this.myName });
    });
    c.on("data", (raw) => this.clientReceive(raw as Msg));
    const lost = () => {
      if (this.destroyed) return;
      this.hostConn = null;
      this.conns.delete(c.peer);
      if (!opened) { this.scheduleRejoin(); return; }
      this.handleHostLost();
    };
    c.on("close", lost);
    c.on("error", lost);
    // safety: if it never opens
    window.setTimeout(() => { if (!opened && !this.destroyed && !this.hostConn) this.scheduleRejoin(); }, 6000);
  }

  private clientReceive(m: Msg) {
    if (!m || typeof m.t !== "string") return;
    switch (m.t) {
      case "welcome":
        this.id = String(m.you || this.id);
        this.hostId = String(m.host || "");
        this.applyRoster(m.roster as SerPlayer[], m.meta as RoomMeta);
        this.ev.onHostChanged(this.hostId, false);
        break;
      case "roster":
        this.applyRoster(m.roster as SerPlayer[], m.meta as RoomMeta);
        break;
      case "hostmigrated":
        this.hostId = String(m.host || "");
        this.applyRoster(m.roster as SerPlayer[], m.meta as RoomMeta);
        this.ev.onHostChanged(this.hostId, this.hostId === this.id);
        break;
      case "hostleave":
        this.handleHostLost();
        break;
      case "full":
        this.ev.onError("Room is full.");
        this.setStatus("error", "full");
        break;
      case "pong":
        break;
      default:
        this.ev.onMessage(m, String(m.f || this.hostId));
    }
  }

  /* -------------------------------------------- host migration ------------------------------------------ */
  private oldSelfId = "";

  private handleHostLost() {
    if (this.migrating || this.destroyed) return;
    this.migrating = true;
    this.hostConn = null;
    this.setStatus("migrating");
    // remove the departed host from the roster
    const oldHost = this.hostId;
    this.players.delete(oldHost);
    for (const p of this.players.values()) p.host = false;
    this.roster();

    const candidates = this.playerList;
    const myIdx = candidates.findIndex((p) => p.id === this.id);
    if (candidates.length === 0 || myIdx < 0) {
      // we somehow lost the roster — just try to rejoin the code
      this.scheduleRejoin();
      return;
    }
    if (myIdx === 0) {
      // lowest join order becomes the new host
      window.setTimeout(() => {
        if (this.destroyed || this.hostConn) return;
        this.oldSelfId = this.id;
        this.becomeHost();
      }, 400);
    } else {
      // others wait, then reconnect to the (re-claimed) room id
      window.setTimeout(() => { if (!this.destroyed && !this.hostConn) this.scheduleRejoin(); }, 900 + myIdx * 120);
    }
  }

  private becomeHost() {
    this.isHost = true;
    this.conns.clear();
    this.setStatus("migrating", "promoting");
    this.spawnHostPeer(false);
  }

  private fallbackToJoin() {
    this.isHost = false;
    this.migrating = true;
    this.joinRoom(this.code, this.myName);
  }

  private scheduleRejoin() {
    if (this.destroyed || this.rejoinTimer !== null) return;
    this.rejoinTries++;
    if (this.rejoinTries > 14) {
      this.setStatus("closed", "lost");
      this.ev.onError("Lost connection to the room.");
      return;
    }
    this.rejoinTimer = window.setTimeout(() => {
      this.rejoinTimer = null;
      if (this.destroyed || this.hostConn) return;
      if (!this.peer || this.peer.destroyed) { this.joinRoom(this.code, this.myName); return; }
      if (this.peer.disconnected) { try { this.peer.reconnect(); } catch { /* ignore */ } }
      this.connectToHost();
    }, 650 + this.rejoinTries * 250);
  }

  /* ------------------------------------------------ shared ----------------------------------------------- */
  private addPlayer(id: string, name: string, order: number, host: boolean) {
    this.players.set(id, { id, name, order, host, alive: true, score: 0, kills: 0, hp: 100, ping: 0 });
  }
  private serializeRoster(): SerPlayer[] {
    return this.playerList.map((p) => ({ i: p.id, n: p.name, o: p.order, h: p.host, s: p.score, k: p.kills }));
  }
  private applyRoster(list: SerPlayer[] | undefined, meta?: RoomMeta) {
    if (meta) this.meta = { ...this.meta, ...meta };
    if (Array.isArray(list)) {
      const seen = new Set<string>();
      for (const r of list) {
        seen.add(r.i);
        const ex = this.players.get(r.i);
        if (ex) { ex.name = r.n; ex.order = r.o; ex.host = r.h; ex.score = r.s; ex.kills = r.k; }
        else this.players.set(r.i, { id: r.i, name: r.n, order: r.o, host: r.h, alive: true, score: r.s, kills: r.k, hp: 100, ping: 0 });
      }
      for (const id of [...this.players.keys()]) if (!seen.has(id)) { this.players.delete(id); this.ev.onPlayerLeave(id); }
      const h = list.find((r) => r.h);
      if (h) this.hostId = h.i;
    }
    this.roster();
  }

  setMeta(patch: Partial<RoomMeta>) {
    if (!this.isHost) return;
    this.meta = { ...this.meta, ...patch };
    this.broadcast({ t: "roster", roster: this.serializeRoster(), meta: this.meta });
    this.roster();
  }
  setStat(id: string, score: number, kills: number) {
    const p = this.players.get(id);
    if (!p) return;
    p.score = score; p.kills = kills;
  }

  /** Broadcast to every other participant. */
  send(m: Msg) {
    if (!this.active) return;
    m.f = this.id;
    if (this.isHost) {
      for (const c of this.conns.values()) { try { c.send(m); } catch { /* ignore */ } }
    } else if (this.hostConn) {
      try { this.hostConn.send(m); } catch { /* ignore */ }
    }
  }
  /** Send to one participant (routed through host when needed). */
  sendTo(to: string, m: Msg) {
    if (!this.active) return;
    m.f = this.id; m.to = to;
    if (this.isHost) { const c = this.conns.get(to); if (c) { try { c.send(m); } catch { /* ignore */ } } }
    else if (this.hostConn) { try { this.hostConn.send(m); } catch { /* ignore */ } }
  }
  private broadcast(m: Msg) {
    m.f = this.id;
    for (const c of this.conns.values()) { try { c.send(m); } catch { /* ignore */ } }
  }

  leave() {
    this.destroyed = true;
    this.active = false;
    if (this.rejoinTimer !== null) { clearTimeout(this.rejoinTimer); this.rejoinTimer = null; }
    try {
      if (this.isHost) this.broadcast({ t: "hostleave" });
      else this.hostConn?.send({ t: "bye" });
    } catch { /* ignore */ }
    setTimeout(() => { try { this.peer?.destroy(); } catch { /* ignore */ } }, 120);
    this.conns.clear();
    this.players.clear();
    this.hostConn = null;
    this.isHost = false;
    this.setStatus("closed");
  }
}

interface SerPlayer { i: string; n: string; o: number; h: boolean; s: number; k: number }
