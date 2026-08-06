import { useState } from "react";
import { WEAPONS, WMAP, type Weapon } from "../game/weapons";
import type { Stats } from "../game/engine";
import type { ScoreRow } from "../game/scores";

const CLASSES = ["ALL", "AR", "SMG", "SNIPER", "PISTOL"] as const;
const CLR: Record<string, string> = { AR: "#b6f04a", SMG: "#4dd2ff", SNIPER: "#ff8a3d", PISTOL: "#ffc23f" };

function Bar({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="pixel w-16 text-[9px] text-[#7f8ea0]">{label}</span>
      <div className="h-[7px] flex-1 bg-black/60">
        <div className="h-full" style={{ width: `${Math.min(100, v * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function WeaponCard({ w, sel, slot, onClick }: { w: Weapon; sel: boolean; slot: number | null; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="btn relative flex flex-col items-start px-2 py-2 text-left"
      style={{ borderColor: sel ? CLR[w.cls] : undefined }}
    >
      <span className="pixel text-[9px]" style={{ color: CLR[w.cls] }}>{w.cls}</span>
      <span className="pixel text-[11px] leading-tight text-white">{w.name}</span>
      <span className="pixel text-[9px] text-[#7f8ea0]">{w.dmg} DMG · {w.mag} RD</span>
      {slot !== null && (
        <span className="pixel absolute -right-2 -top-2 border-2 border-black bg-[#b6f04a] px-1 text-[9px] text-black">
          {slot === 0 ? "P" : "S"}
        </span>
      )}
    </button>
  );
}

export function StartScreen({
  loadout, setLoadout, scores, onStart, touch, onMulti, onSettings, onControls, name,
}: {
  loadout: string[]; setLoadout: (l: string[]) => void; scores: ScoreRow[]; onStart: () => void; touch: boolean;
  onMulti?: () => void; onSettings?: () => void; onControls?: () => void; name?: string;
}) {
  const [slot, setSlot] = useState(0);
  const [filter, setFilter] = useState<(typeof CLASSES)[number]>("ALL");
  const [preview, setPreview] = useState<string>(loadout[0]);
  const w = WMAP[preview] ?? WEAPONS[0];
  const list = WEAPONS.filter((x) => filter === "ALL" || x.cls === filter);

  const pick = (id: string) => {
    const next = [...loadout];
    next[slot] = id;
    if (next[0] === next[1]) next[slot === 0 ? 1 : 0] = loadout[slot];
    setLoadout(next);
    setPreview(id);
    setSlot(slot === 0 ? 1 : 0);
  };

  return (
    <div className="scrollbar absolute inset-0 overflow-y-auto">
      <div className="scan pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
        <div className="text-center">
          <h1 className="pixel tshadow text-4xl leading-none text-[#b6f04a] sm:text-6xl">BLOCKFRONT</h1>
          <p className="pixel mt-2 text-[10px] text-[#8fa3b6] sm:text-xs">VOXEL SURVIVAL FPS · 16 WEAPONS · ENDLESS WAVES</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {onMulti && <button onClick={onMulti} className="btn pixel px-3 py-2 text-[10px] text-[#4dd2ff]">◈ MULTIPLAYER</button>}
            {onControls && <button onClick={onControls} className="btn pixel px-3 py-2 text-[10px] text-white">{touch ? "MOBILE" : "PC"} CONTROLS</button>}
            {onSettings && <button onClick={onSettings} className="btn pixel px-3 py-2 text-[10px] text-white">⚙ SETTINGS</button>}
            {name && <span className="pixel border-2 border-[#2c3644] px-2 py-2 text-[10px] text-[#b6f04a]">{name}</span>}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          {/* armory */}
          <div className="panel p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="pixel text-xs text-white">ARMORY</span>
              <div className="ml-auto flex gap-1">
                {CLASSES.map((c) => (
                  <button key={c} onClick={() => setFilter(c)}
                    className="pixel border-2 px-2 py-1 text-[9px]"
                    style={{ borderColor: filter === c ? "#b6f04a" : "#2c3644", color: filter === c ? "#b6f04a" : "#7f8ea0" }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              {[0, 1].map((i) => (
                <button key={i} onClick={() => { setSlot(i); setPreview(loadout[i]); }}
                  className="btn px-3 py-2 text-left"
                  style={{ borderColor: slot === i ? "#b6f04a" : undefined }}>
                  <div className="pixel text-[9px] text-[#7f8ea0]">{i === 0 ? "PRIMARY [1]" : "SECONDARY [2]"}</div>
                  <div className="pixel text-sm text-white">{WMAP[loadout[i]]?.name}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {list.map((x) => (
                <WeaponCard key={x.id} w={x} sel={preview === x.id}
                  slot={loadout[0] === x.id ? 0 : loadout[1] === x.id ? 1 : null}
                  onClick={() => pick(x.id)} />
              ))}
            </div>
          </div>

          {/* preview + scores */}
          <div className="flex flex-col gap-4">
            <div className="panel p-3 sm:p-4">
              <div className="pixel text-[10px]" style={{ color: CLR[w.cls] }}>{w.cls}</div>
              <div className="pixel tshadow text-2xl text-white">{w.name}</div>
              <p className="pixel mt-1 text-[10px] leading-relaxed text-[#8fa3b6]">{w.blurb}</p>
              <div className="mt-3 flex flex-col gap-[6px]">
                <Bar label="DAMAGE" v={w.dmg / 260} color="#ff4d5e" />
                <Bar label="RATE" v={w.rpm / 1100} color="#4dd2ff" />
                <Bar label="CONTROL" v={1 - Math.min(1, w.recoil / 5)} color="#b6f04a" />
                <Bar label="MAG" v={w.mag / 50} color="#ffc23f" />
                <Bar label="ZOOM" v={w.zoom / 4.2} color="#c58cff" />
              </div>
              <div className="pixel mt-3 grid grid-cols-3 gap-2 text-center text-[9px] text-[#7f8ea0]">
                <div className="border-2 border-[#2c3644] py-1">{w.rpm} RPM<br /><span className="text-white">{w.auto ? "AUTO" : "SEMI"}</span></div>
                <div className="border-2 border-[#2c3644] py-1">RELOAD<br /><span className="text-white">{w.reload.toFixed(1)}s</span></div>
                <div className="border-2 border-[#2c3644] py-1">PIERCE<br /><span className="text-white">{w.pierce}x</span></div>
              </div>
            </div>

            <button onClick={onStart} className="btn btn-go glow pixel py-4 text-xl">DEPLOY ▶</button>

            <div className="panel p-3">
              <div className="pixel mb-2 text-[10px] text-[#7f8ea0]">LOCAL HIGH SCORES</div>
              {scores.length === 0 ? (
                <div className="pixel text-[10px] text-[#4f5c6b]">NO RUNS YET — GO MAKE HISTORY</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {scores.slice(0, 5).map((s, i) => (
                    <div key={i} className="pixel flex items-center gap-2 text-[10px]">
                      <span className="w-5 text-[#ffc23f]">{i + 1}.</span>
                      <span className="w-16 text-white">{s.score.toLocaleString()}</span>
                      <span className="text-[#7f8ea0]">W{s.wave} · {s.kills}K · {s.acc}%</span>
                      <span className="ml-auto text-[#4f5c6b]">{s.best}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="panel p-3">
          <div className="pixel mb-2 text-[10px] text-[#7f8ea0]">CONTROLS</div>
          <div className="pixel grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-[#cfe0ee] sm:grid-cols-4">
            {(touch
              ? [["LEFT STICK", "MOVE"], ["DRAG RIGHT", "LOOK"], ["FIRE", "SHOOT"], ["ADS", "AIM"], ["JUMP", "HOP"], ["RELOAD", "RELOAD"], ["SWAP", "SWITCH GUN"], ["❚❚", "PAUSE"]]
              : [["WASD", "MOVE"], ["MOUSE", "LOOK"], ["LMB", "FIRE"], ["RMB", "AIM"], ["SPACE", "JUMP"], ["SHIFT", "SPRINT"], ["R", "RELOAD"], ["Q / 1 / 2", "SWITCH"], ["ESC", "PAUSE"], ["M", "MUTE"]]
            ).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="border-2 border-[#2c3644] px-1 text-[#b6f04a]">{k}</span>
                <span className="text-[#7f8ea0]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PauseScreen({ onResume, onRestart, onMenu, muted, toggleMute, onSettings, mp }: {
  onResume: () => void; onRestart: () => void; onMenu: () => void; muted: boolean; toggleMute: () => void;
  onSettings?: () => void; mp?: boolean;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm">
      <div className="panel pop w-[min(92vw,380px)] p-5 text-center">
        <div className="pixel tshadow text-3xl text-[#b6f04a]">{mp ? "MENU" : "PAUSED"}</div>
        {mp && <div className="pixel mt-1 text-[9px] text-[#ffc23f]">MATCH KEEPS RUNNING — STAY SHARP</div>}
        <div className="mt-5 flex flex-col gap-2">
          <button onClick={onResume} className="btn btn-go pixel py-3 text-sm">{mp ? "BACK TO MATCH" : "RESUME"}</button>
          {!mp && <button onClick={onRestart} className="btn pixel py-3 text-sm text-white">RESTART RUN</button>}
          {onSettings && <button onClick={onSettings} className="btn pixel py-3 text-sm text-white">⚙ SETTINGS</button>}
          <button onClick={toggleMute} className="btn pixel py-3 text-sm text-white">SOUND: {muted ? "OFF" : "ON"}</button>
          <button onClick={onMenu} className="btn pixel py-3 text-sm text-[#ff8a9b]">{mp ? "LEAVE ROOM" : "QUIT TO ARMORY"}</button>
        </div>
      </div>
    </div>
  );
}

export function OverScreen({ stats, scores, rank, onRestart, onMenu }: {
  stats: Stats; scores: ScoreRow[]; rank: number; onRestart: () => void; onMenu: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="panel pop w-[min(94vw,560px)] p-5">
        <div className="text-center">
          <div className="pixel tshadow text-4xl text-[#ff4d5e]">YOU DIED</div>
          {rank === 0 && <div className="pixel mt-1 text-xs text-[#ffc23f]">★ NEW HIGH SCORE ★</div>}
          <div className="pixel mt-3 text-[10px] text-[#7f8ea0]">FINAL SCORE</div>
          <div className="pixel tshadow text-5xl text-[#b6f04a]">{stats.score.toLocaleString()}</div>
        </div>
        <div className="pixel mt-4 grid grid-cols-3 gap-2 text-center text-[10px] text-[#7f8ea0]">
          {[["WAVE", stats.wave], ["KILLS", stats.kills], ["HEADSHOTS", stats.headshots],
            ["ACCURACY", `${stats.acc}%`], ["SURVIVED", `${stats.time}s`], ["TOP GUN", stats.best]].map(([k, v]) => (
            <div key={String(k)} className="border-2 border-[#2c3644] py-2">
              {k}<br /><span className="text-base text-white">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onRestart} className="btn btn-go pixel flex-1 py-3 text-sm">RETRY ⟳</button>
          <button onClick={onMenu} className="btn pixel flex-1 py-3 text-sm text-white">ARMORY</button>
        </div>
        <div className="mt-4">
          <div className="pixel mb-1 text-[10px] text-[#7f8ea0]">HIGH SCORES</div>
          <div className="flex flex-col gap-1">
            {scores.map((s, i) => (
              <div key={i} className="pixel flex items-center gap-2 text-[10px]" style={{ color: i === rank ? "#ffc23f" : "#8fa3b6" }}>
                <span className="w-5">{i + 1}.</span>
                <span className="w-16 text-white">{s.score.toLocaleString()}</span>
                <span>W{s.wave} · {s.kills}K · {s.acc}%</span>
                <span className="ml-auto text-[#4f5c6b]">{s.best}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
