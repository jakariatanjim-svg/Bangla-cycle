import { useCallback, useEffect, useRef, useState } from "react";
import { Game, type HudState, type Stats } from "./game/engine";
import { MP } from "./game/mp";
import { Net, type NetPlayer, type NetStatus, type RoomMeta } from "./net/net";
import { Hud, type Board } from "./ui/Hud";
import { TouchControls } from "./ui/Touch";
import { StartScreen, PauseScreen, OverScreen } from "./ui/Screens";
import { ControlModeScreen, SettingsPanel, LobbyScreen, ComingSoonPanel } from "./ui/Multi";
import { loadScores, saveScore, loadLoadout, saveLoadout, type ScoreRow } from "./game/scores";
import {
  loadSettings, saveSettings, loadRecentRooms, pushRecentRoom, makeRoomCode,
  type Settings, type RecentRoom, type ControlMode,
} from "./game/settings";

type Phase = "controls" | "menu" | "lobby" | "playing" | "paused" | "over";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const netRef = useRef<Net | null>(null);
  const mpRef = useRef<MP | null>(null);
  const phaseRef = useRef<Phase>("menu");

  const [ready, setReady] = useState(false);
  const [phase, setPhaseState] = useState<Phase>("menu");
  const [hud, setHud] = useState<HudState | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [scores, setScores] = useState<ScoreRow[]>(() => loadScores());
  const [rank, setRank] = useState(-1);
  const [loadout, setLoadoutState] = useState<string[]>(() => loadLoadout());
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [locked, setLocked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [recent, setRecent] = useState<RecentRoom[]>(() => loadRecentRooms());
  const [fps, setFps] = useState(60);

  // net state mirrors
  const [netStatus, setNetStatus] = useState<NetStatus>("idle");
  const [players, setPlayers] = useState<NetPlayer[]>([]);
  const [meta, setMeta] = useState<RoomMeta>({ code: "", maxPlayers: 10, pvp: false, started: false, wave: 1 });
  const [netErr, setNetErr] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [board, setBoard] = useState<Board[]>([]);
  const [showBoard, setShowBoard] = useState(false);
  const [hostToast, setHostToast] = useState("");

  const coarse = typeof window !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const mode: ControlMode = settings.controlMode ?? (coarse ? "mobile" : "pc");
  const touch = mode === "mobile";

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const setLoadout = (l: string[]) => { setLoadoutState(l); saveLoadout(l); };
  
  const set = useCallback((patch: Partial<Settings>) => {
    setSettingsState((prev) => {
      const n = { ...prev, ...patch };
      saveSettings(n);
      return n;
    });
  }, []);

  /* ------------------------------------------------ boot ------------------------------------------------ */
  useEffect(() => {
    if (!canvasRef.current || !fxRef.current || gameRef.current) return;
    const g = new Game(canvasRef.current, fxRef.current, {
      onHud: (h) => setHud(h),
      onOver: (s) => {
        const row: ScoreRow = { score: s.score, wave: s.wave, kills: s.kills, acc: s.acc, best: s.best, date: Date.now() };
        const res = saveScore(row);
        setScores(res.rows); setRank(res.rank); setStats(s);
        setPhase("over");
      },
    });
    gameRef.current = g;
    g.beginIdle();
    setReady(true);
    // restore saved control preference
    const s = loadSettings();
    if (!s.controlMode || !s.rememberControls) setPhase("controls");
    return () => { g.dispose(); gameRef.current = null; };
  }, []);

  /* apply settings to the live engine whenever they change */
  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    g.sens = settings.sens;
    g.touchSens = settings.touchSens;
    g.invertY = settings.invertY;
    g.touchDevice = touch;
    g.keyMap = settings.keyMap;

    g.sfx.setMuted(settings.muted);
    g.sfx.setVolume(settings.sfxVolume * settings.masterVolume, settings.bgmVolume * settings.masterVolume);
    
    const dpr = Math.min(devicePixelRatio || 1, touch ? 1.25 : 1.75);
    const scale = settings.quality === "low" ? 0.6 : settings.quality === "med" ? 0.85 : 1;
    g.renderer.setPixelRatio(Math.max(0.5, dpr * scale));
    g.resize();
  }, [settings, touch]);

  /* fps meter */
  useEffect(() => {
    if (!settings.showFps) return;
    let f = 0, t = performance.now(), raf = 0;
    const tick = () => {
      f++;
      const n = performance.now();
      if (n - t >= 500) { setFps(Math.round((f * 1000) / (n - t))); f = 0; t = n; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [settings.showFps]);

  /* -------------------------------------------- global hotkeys -------------------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      if (e.code === "KeyM") { const m = !g.sfx.muted; set({ muted: m }); }
      if (e.code === "Tab" && phaseRef.current === "playing") { e.preventDefault(); setShowBoard(true); }
      if (e.code === "Escape" && phaseRef.current === "playing") softPause();
      if (e.code === "Enter" && phaseRef.current === "over") restart();
    };
    const onUp = (e: KeyboardEvent) => { if (e.code === "Tab") setShowBoard(false); };
    const onPL = () => {
      const g = gameRef.current;
      if (!g || touch) return;
      setLocked(!!document.pointerLockElement);
      if (phaseRef.current === "playing" && !document.pointerLockElement && !g.over) softPause();
    };
    addEventListener("keydown", onKey);
    addEventListener("keyup", onUp);
    document.addEventListener("pointerlockchange", onPL);
    return () => {
      removeEventListener("keydown", onKey);
      removeEventListener("keyup", onUp);
      document.removeEventListener("pointerlockchange", onPL);
    };
  });

  /* scoreboard refresh while playing */
  useEffect(() => {
    if (phase !== "playing" || !mpRef.current) return;
    const id = setInterval(() => { if (mpRef.current) setBoard(mpRef.current.scoreboard()); }, 700);
    return () => clearInterval(id);
  }, [phase]);

  /* ------------------------------------------------ net ------------------------------------------------ */
  const ensureNet = () => {
    if (netRef.current) return netRef.current;
    const net = new Net({
      onStatus: (s) => { setNetStatus(s); if (s === "connected" || s === "hosting") { setInRoom(true); setNetErr(""); } },
      onRoster: (pl, m) => { setPlayers(pl); setMeta({ ...m }); if (mpRef.current) mpRef.current.syncRoster(); },
      onMessage: (m, from) => { mpRef.current?.handle(m, from); },
      onHostChanged: (_hostId, iAmHost) => {
        const mp = mpRef.current;
        if (mp) {
          mp.onIdChanged(net.id);
          gameRef.current?.setToast(iAmHost ? "YOU ARE NOW THE HOST" : "HOST MIGRATED");
        }
        setHostToast(iAmHost ? "YOU ARE NOW THE HOST" : "");
        setTimeout(() => setHostToast(""), 2600);
      },
      onPlayerJoin: (p) => gameRef.current?.addFeed(`${p.name} JOINED`, false),
      onPlayerLeave: () => { mpRef.current?.syncRoster(); },
      onError: (msg) => setNetErr(msg),
    });
    netRef.current = net;
    return net;
  };

  const createRoom = (size: number, pvp: boolean) => {
    const net = ensureNet();
    const code = makeRoomCode();
    setNetErr("");
    set({ maxPlayers: size, pvp });
    net.createRoom(code, settings.name, size, pvp);
    setRecent(pushRecentRoom(code));
  };
  const joinRoom = (code: string) => {
    const net = ensureNet();
    setNetErr("");
    net.joinRoom(code, settings.name);
    setRecent(pushRecentRoom(code));
  };
  const leaveRoom = () => {
    mpRef.current?.dispose();
    mpRef.current = null;
    netRef.current?.leave();
    netRef.current = null;
    setInRoom(false); setPlayers([]); setNetStatus("idle"); setNetErr("");
    if (gameRef.current) gameRef.current.mp = null;
  };

  /* ----------------------------------------------- flow ----------------------------------------------- */
  const startSolo = () => {
    const g = gameRef.current;
    if (!g) return;
    mpRef.current?.dispose();
    mpRef.current = null;
    setRank(-1);
    g.start(loadout, { mp: null, pvp: false, sens: settings.sens, touchSens: settings.touchSens, invertY: settings.invertY, useTouch: touch });
    setHud(g.hud());
    setPhase("playing");
  };

  const startMatch = () => {
    const g = gameRef.current;
    const net = netRef.current;
    if (!g || !net) return;
    if (!mpRef.current) {
      const mp = new MP(g, net);
      mp.onRosterDirty = () => setBoard(mp.scoreboard());
      mpRef.current = mp;
    }
    const mp = mpRef.current!;
    mp.onIdChanged(net.id);
    if (net.isHost) net.setMeta({ started: true });
    setRank(-1);
    g.start(loadout, {
      mp, pvp: net.meta.pvp, sens: settings.sens, touchSens: settings.touchSens,
      invertY: settings.invertY, useTouch: touch,
    });
    setBoard(mp.scoreboard());
    setHud(g.hud());
    setPhase("playing");
  };

  const restart = () => { if (mpRef.current) startMatch(); else startSolo(); };
  const softPause = () => {
    const g = gameRef.current;
    if (!g) return;
    if (mpRef.current) {
      // never freeze the shared simulation — just surface the menu
      g.firing = false;
      if (document.pointerLockElement) document.exitPointerLock();
    } else g.pause();
    setPhase("paused");
  };
  const resume = () => {
    const g = gameRef.current;
    if (!g) return;
    if (mpRef.current) { g.sfx.resume(); if (!touch) g.lock(); }
    else g.resume();
    setPhase("playing");
  };
  const toMenu = () => {
    leaveRoom();
    gameRef.current?.beginIdle();
    setPhase("menu");
  };
  const toLobby = () => { setNetErr(""); setPhase("lobby"); };

  const g = gameRef.current;
  const showLockHint = phase === "playing" && !touch && !locked;
  const roomCode = netRef.current?.code ?? "";

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0b0e13]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div ref={fxRef} className="pointer-events-none absolute inset-0 overflow-hidden" />

      {phase === "playing" && hud && (
        <Hud h={hud} board={board} room={roomCode} showBoard={showBoard || (touch && !!hud.mp)} />
      )}
      {phase === "playing" && touch && ready && g && <TouchControls game={g} onPause={softPause} settings={settings} />}

      {settings.showFps && (
        <div className="pixel pointer-events-none absolute right-2 bottom-2 z-30 border-2 border-[#2c3644] bg-black/50 px-2 py-1 text-[9px]"
          style={{ color: fps >= 55 ? "#b6f04a" : fps >= 35 ? "#ffc23f" : "#ff4d5e" }}>
          {fps} FPS
        </div>
      )}
      {hostToast && (
        <div className="pixel pointer-events-none absolute left-1/2 top-24 z-30 -translate-x-1/2 border-2 border-[#b6f04a]/60 bg-black/70 px-3 py-2 text-[11px] text-[#b6f04a]">
          {hostToast}
        </div>
      )}
      {showLockHint && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-24">
          <div className="pixel border-2 border-[#b6f04a]/50 bg-black/60 px-3 py-2 text-[10px] text-[#b6f04a]">CLICK TO CAPTURE MOUSE</div>
        </div>
      )}

      {phase === "controls" && (
        <ControlModeScreen
          initial={mode}
          remember={settings.rememberControls}
          onConfirm={(m, rem) => { set({ controlMode: m, rememberControls: rem }); setPhase("menu"); }}
        />
      )}

      {phase === "menu" && (
        <div className="absolute inset-0 bg-[#0b0e13]/72">
          <StartScreen
            loadout={loadout} setLoadout={setLoadout} scores={scores} onStart={startSolo} touch={touch}
            onMulti={toLobby} onSettings={() => setShowSettings(true)} onControls={() => setShowComingSoon(true)}
            name={settings.name}
          />
        </div>
      )}

      {phase === "lobby" && (
        <LobbyScreen
          status={netStatus} players={players} meta={meta} isHost={!!netRef.current?.isHost}
          inRoom={inRoom} myId={netRef.current?.id ?? ""} code={roomCode} error={netErr}
          recent={recent} settings={settings}
          onCreate={createRoom} onJoin={joinRoom} onLeave={() => { leaveRoom(); }}
          onStartMatch={startMatch} onSetMeta={(p) => netRef.current?.setMeta(p)}
          onBack={() => setPhase("menu")}
        />
      )}

      {phase === "paused" && (
        <PauseScreen
          onResume={resume} onRestart={restart} onMenu={toMenu}
          muted={settings.muted} toggleMute={() => set({ muted: !settings.muted })}
          onSettings={() => setShowSettings(true)}
          mp={!!mpRef.current}
        />
      )}
      {phase === "over" && stats && (
        <OverScreen stats={stats} scores={scores} rank={rank} onRestart={restart} onMenu={toMenu} />
      )}

      {showSettings && (
        <SettingsPanel s={settings} set={set} inGame={phase === "paused"} onClose={() => setShowSettings(false)} />
      )}
      {showComingSoon && (
        <ComingSoonPanel onClose={() => setShowComingSoon(false)} />
      )}
      {showControls && (
        <ControlModeScreen
          initial={mode} remember={settings.rememberControls}
          onBack={() => setShowControls(false)}
          onConfirm={(m, rem) => { set({ controlMode: m, rememberControls: rem }); setShowControls(false); }}
        />
      )}

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pixel text-sm text-[#b6f04a]">BUILDING WORLD…</div>
        </div>
      )}
    </div>
  );
}
