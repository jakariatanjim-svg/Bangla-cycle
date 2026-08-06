import type { HudState } from "../game/engine";

export interface Board { name: string; score: number; kills: number; host: boolean; me: boolean; alive: boolean }

export function Hud({ h, board, room, showBoard }: { h: HudState; board?: Board[]; room?: string; showBoard?: boolean }) {
  const hpPct = Math.max(0, h.hp) / 100;
  const ammoPct = h.mag ? h.ammo / h.mag : 0;
  const low = ammoPct <= 0.25;
  const gap = 6 + h.spread * 7;
  const scoped = h.ads && h.zoom > 2.6;

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* hurt flash */}
      <div
        className="absolute inset-0 transition-opacity duration-150"
        style={{
          opacity: Math.min(0.75, h.hurt * 1.5),
          background: "radial-gradient(ellipse at center, rgba(255,0,40,0) 30%, rgba(255,20,50,0.85) 100%)",
        }}
      />
      {/* low health pulse */}
      {h.hp <= 35 && h.hp > 0 && (
        <div className="absolute inset-0 animate-pulse" style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(255,40,60,0.35) 100%)" }} />
      )}
      <div className="vignette absolute inset-0" />

      {/* scope */}
      {scoped && (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-black" style={{ clipPath: "polygon(0 0,100% 0,100% 100%,0 100%)", WebkitMaskImage: "radial-gradient(circle at center, transparent 0 31%, black 31.5%)", maskImage: "radial-gradient(circle at center, transparent 0 31%, black 31.5%)" }} />
          <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-black/70" />
          <div className="absolute top-1/2 left-0 w-full h-[2px] -translate-y-1/2 bg-black/70" />
          <div className="absolute left-1/2 top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 bg-[#ff3b3b]" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black/60" style={{ width: "62vmin", height: "62vmin" }} />
        </div>
      )}

      {/* crosshair */}
      {!scoped && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-16 w-16">
            <span className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 bg-white/90" />
            {[0, 1, 2, 3].map((i) => {
              const st: React.CSSProperties = { position: "absolute", background: h.hitmark ? (h.hitmark === 2 ? "#ffd23f" : "#fff") : "rgba(255,255,255,0.92)" };
              const len = 8;
              if (i === 0) Object.assign(st, { left: "50%", top: `calc(50% - ${gap + len}px)`, width: 3, height: len, transform: "translateX(-50%)" });
              if (i === 1) Object.assign(st, { left: "50%", top: `calc(50% + ${gap}px)`, width: 3, height: len, transform: "translateX(-50%)" });
              if (i === 2) Object.assign(st, { top: "50%", left: `calc(50% - ${gap + len}px)`, height: 3, width: len, transform: "translateY(-50%)" });
              if (i === 3) Object.assign(st, { top: "50%", left: `calc(50% + ${gap}px)`, height: 3, width: len, transform: "translateY(-50%)" });
              return <span key={i} style={st} />;
            })}
          </div>
        </div>
      )}
      {/* hitmarker */}
      {h.hitmark > 0 && (
        <div className="pop absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <svg width="46" height="46" viewBox="0 0 46 46">
            {[[8, 8, 16, 16], [38, 8, 30, 16], [8, 38, 16, 30], [38, 38, 30, 30]].map((p, i) => (
              <line key={i} x1={p[0]} y1={p[1]} x2={p[2]} y2={p[3]} stroke={h.hitmark === 2 ? "#ffd23f" : "#ffffff"} strokeWidth="4" />
            ))}
          </svg>
        </div>
      )}

      {/* top-left: wave / score */}
      <div className="absolute left-3 top-3 flex flex-col gap-2 sm:left-5 sm:top-5">
        <div className="panel px-3 py-2">
          <div className="pixel text-[10px] text-[#7f8ea0]">WAVE</div>
          <div className="pixel tshadow text-2xl leading-none text-[#b6f04a] sm:text-3xl">{String(h.wave).padStart(2, "0")}</div>
          <div className="pixel mt-1 text-[10px] text-[#ff8a9b]">{h.alive} HOSTILE{h.alive === 1 ? "" : "S"}</div>
        </div>
        <div className="panel px-3 py-2">
          <div className="pixel text-[10px] text-[#7f8ea0]">SCORE</div>
          <div className="pixel tshadow text-xl leading-none text-white sm:text-2xl">{h.score.toLocaleString()}</div>
          {h.combo > 1 && (
            <div className="mt-1">
              <div className="pixel text-[10px] text-[#ffc23f]">x{h.mult} COMBO · {h.combo}</div>
              <div className="mt-1 h-[5px] w-24 bg-black/60">
                <div className="h-full bg-[#ffc23f] transition-[width] duration-100" style={{ width: `${h.comboPct * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* respawn overlay */}
      {h.dead && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#3a0810]/55">
          <div className="pixel tshadow text-4xl text-[#ff4d5e] sm:text-6xl">ELIMINATED</div>
          <div className="pixel tshadow mt-2 text-sm text-white">RESPAWNING IN</div>
          <div className="pixel tshadow text-6xl text-[#b6f04a] sm:text-7xl">{Math.max(1, Math.ceil(h.respawnT))}</div>
          <div className="mt-3 h-[6px] w-52 border-2 border-black/50 bg-black/60">
            <div className="h-full bg-[#b6f04a] transition-[width] duration-200" style={{ width: `${(1 - h.respawnT / 3) * 100}%` }} />
          </div>
        </div>
      )}

      {/* room + scoreboard */}
      {h.mp && (
        <div className="absolute left-1/2 top-2 flex -translate-x-1/2 flex-col items-center gap-1">
          <div className="pixel flex items-center gap-2 border-2 border-[#2c3644] bg-black/55 px-2 py-1 text-[9px] text-[#8fa3b6]">
            <span className="text-[#4dd2ff]">ROOM {room}</span>
            <span style={{ color: h.pvp ? "#ff4d5e" : "#7f8ea0" }}>PVP {h.pvp ? "ON" : "OFF"}</span>
            <span className="text-[#b6f04a]">{board?.length ?? 1}P</span>
          </div>
          {showBoard && board && (
            <div className="panel w-56 px-2 py-2">
              {board.slice(0, 10).map((p, i) => (
                <div key={i} className="pixel flex items-center gap-2 text-[9px]" style={{ color: p.me ? "#b6f04a" : p.alive ? "#cfe0ee" : "#6b7885" }}>
                  <span className="w-3">{p.host ? "★" : ""}</span>
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="w-8 text-right text-white">{p.kills}</span>
                  <span className="w-12 text-right">{p.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* kill feed */}
      <div className="absolute right-3 top-3 flex w-44 flex-col items-end gap-1 sm:right-5 sm:top-5 sm:w-56">
        {h.feed.map((f) => (
          <div key={f.id} className={`feed pixel px-2 py-1 text-[10px] tshadow ${f.crit ? "bg-[#ffc23f]/20 text-[#ffd76a] border-[#ffc23f]/60" : "bg-black/45 text-[#cfe0ee] border-white/10"} border-2`}>
            {f.text}
          </div>
        ))}
      </div>

      {/* banner */}
      {h.banner && (
        <div key={h.banner + h.bannerSub} className="banner absolute left-1/2 top-[16%] -translate-x-1/2 text-center">
          <div className="pixel tshadow text-3xl text-[#b6f04a] sm:text-5xl">{h.banner}</div>
          <div className="pixel tshadow mt-1 text-xs text-[#e8f0f7] sm:text-base">{h.bannerSub}</div>
        </div>
      )}
      {h.toast && (
        <div key={h.toast} className="rise absolute left-1/2 top-[62%] -translate-x-1/2">
          <div className="pixel border-2 border-[#4dd2ff]/60 bg-black/60 px-3 py-1 text-xs text-[#9fe8ff] tshadow">{h.toast}</div>
        </div>
      )}

      {/* health */}
      <div className="absolute bottom-3 left-3 sm:bottom-5 sm:left-5">
        <div className="panel px-3 py-2">
          <div className="flex items-end gap-2">
            <span className="pixel text-[10px] text-[#7f8ea0]">HP</span>
            <span className="pixel tshadow text-2xl leading-none" style={{ color: hpPct > 0.5 ? "#b6f04a" : hpPct > 0.25 ? "#ffc23f" : "#ff4d5e" }}>
              {Math.max(0, h.hp)}
            </span>
          </div>
          <div className="mt-1 flex gap-[3px]">
            {Array.from({ length: 10 }).map((_, i) => {
              const on = hpPct * 10 > i;
              return <span key={i} className="h-3 w-[9px] sm:w-3" style={{ background: on ? (hpPct > 0.5 ? "#b6f04a" : hpPct > 0.25 ? "#ffc23f" : "#ff4d5e") : "rgba(255,255,255,0.12)" }} />;
            })}
          </div>
          <div className="pixel mt-1 flex items-center gap-1 text-[10px] text-[#8fa3b6]">
            <span>[G]</span>
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className="inline-block h-3 w-2" style={{ background: i < h.nades ? "#5f9e46" : "rgba(255,255,255,0.12)" }} />
            ))}
          </div>
        </div>
      </div>

      {/* weapon */}
      <div className="absolute bottom-3 right-3 text-right sm:bottom-5 sm:right-5">
        <div className="panel px-3 py-2">
          <div className="pixel text-[10px] text-[#7f8ea0]">{h.wcls}</div>
          <div className="pixel tshadow text-sm text-white sm:text-lg">{h.wname}</div>
          <div className="pixel tshadow leading-none" style={{ color: low ? "#ff4d5e" : "#e8f0f7" }}>
            <span className="text-3xl sm:text-4xl">{h.ammo}</span>
            <span className="text-base text-[#7f8ea0]"> / {h.mag}</span>
          </div>
          <div className="mt-1 h-[5px] w-32 bg-black/60 sm:w-40">
            <div className="h-full transition-[width] duration-100" style={{ width: `${ammoPct * 100}%`, background: low ? "#ff4d5e" : "#4dd2ff" }} />
          </div>
          {h.reloading ? (
            <div className="mt-1">
              <div className="pixel text-[10px] text-[#ffc23f]">RELOADING</div>
              <div className="h-[5px] w-32 bg-black/60 sm:w-40">
                <div className="h-full bg-[#ffc23f]" style={{ width: `${h.reloadPct * 100}%` }} />
              </div>
            </div>
          ) : (
            <div className="pixel mt-1 text-[10px] text-[#7f8ea0]">
              [Q] {h.otherName} {h.otherAmmo}/{h.otherMag}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
