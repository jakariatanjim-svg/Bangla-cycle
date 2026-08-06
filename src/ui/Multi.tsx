import { useState } from "react";
import type { NetPlayer, NetStatus, RoomMeta } from "../net/net";
import { type RecentRoom, type Settings, type ControlMode, type KeyMap, type HudCustomization, DEFAULT_KEYMAP, DEFAULT_HUD } from "../game/settings";

/* ------------------------------------------------ control mode ------------------------------------------------ */
export function ControlModeScreen({
  initial, remember, onConfirm, onBack,
}: { initial: ControlMode; remember: boolean; onConfirm: (m: ControlMode, remember: boolean) => void; onBack?: () => void }) {
  const [mode, setMode] = useState<ControlMode>(initial);
  const [rem, setRem] = useState(remember);

  const Card = ({ id, title, sub, lines }: { id: ControlMode; title: string; sub: string; lines: string[] }) => (
    <button onClick={() => setMode(id)} className="btn flex-1 p-4 text-left" style={{ borderColor: mode === id ? "#b6f04a" : undefined }}>
      <div className="pixel text-lg text-white sm:text-2xl">{title}</div>
      <div className="pixel mt-1 text-[10px]" style={{ color: mode === id ? "#b6f04a" : "#7f8ea0" }}>{sub}</div>
      <div className="mt-3 flex flex-col gap-1">
        {lines.map((l) => <div key={l} className="pixel text-[10px] text-[#8fa3b6]">· {l}</div>)}
      </div>
      <div className="pixel mt-3 text-[10px]" style={{ color: mode === id ? "#b6f04a" : "#4f5c6b" }}>
        {mode === id ? "▣ SELECTED" : "▢ SELECT"}
      </div>
    </button>
  );

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-[#0b0e13]/92 p-4">
      <div className="scan pointer-events-none absolute inset-0" />
      <div className="panel relative w-[min(96vw,760px)] p-4 sm:p-6">
        <div className="text-center">
          <div className="pixel tshadow text-2xl text-[#b6f04a] sm:text-4xl">CONTROL MODE</div>
          <div className="pixel mt-1 text-[10px] text-[#8fa3b6]">HOW DO YOU WANT TO PLAY? (CHANGEABLE IN SETTINGS)</div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Card id="pc" title="PC CONTROLS" sub="KEYBOARD + MOUSE"
            lines={["WASD MOVE · MOUSE LOOK", "LMB FIRE · RMB AIM", "R RELOAD · G GRENADE", "SHIFT SPRINT · Q SWAP", "C CROUCH / SLIDE"]} />
          <Card id="mobile" title="MOBILE CONTROLS" sub="TOUCH SCREEN"
            lines={["LEFT STICK MOVE", "DRAG RIGHT TO LOOK", "ON-SCREEN FIRE / AIM", "TAP BUTTONS FOR ACTIONS", "DOUBLE TAP TO SLIDE"]} />
        </div>
        <label className="mt-4 flex cursor-pointer items-center justify-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center border-2" style={{ borderColor: rem ? "#b6f04a" : "#3a4657", background: rem ? "#b6f04a" : "transparent" }}>
            {rem && <span className="pixel text-[11px] leading-none text-black">✓</span>}
          </span>
          <input type="checkbox" className="hidden" checked={rem} onChange={(e) => setRem(e.target.checked)} />
          <span className="pixel text-[11px] text-[#cfe0ee]">REMEMBER MY CHOICE</span>
        </label>
        <div className="mt-4 flex gap-2">
          {onBack && <button onClick={onBack} className="btn pixel flex-1 py-3 text-sm text-white">BACK</button>}
          <button onClick={() => onConfirm(mode, rem)} className="btn btn-go pixel flex-[2] py-3 text-sm">CONTINUE ▶</button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------- settings -------------------------------------------------- */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="pixel w-28 shrink-0 text-[10px] text-[#7f8ea0]">{label}</span>
      <div className="flex flex-1 items-center gap-2">{children}</div>
    </div>
  );
}
function Toggle({ on, onClick, labels = ["OFF", "ON"] }: { on: boolean; onClick: () => void; labels?: [string, string] | string[] }) {
  return (
    <button onClick={onClick} className="btn pixel px-3 py-1 text-[10px]" style={{ borderColor: on ? "#b6f04a" : "#3a4657", color: on ? "#b6f04a" : "#8fa3b6" }}>
      {on ? labels[1] : labels[0]}
    </button>
  );
}

export function SettingsPanel({
  s, set, onClose, inGame,
}: { s: Settings; set: (p: Partial<Settings>) => void; onClose: () => void; inGame?: boolean }) {
  const [tab, setTab] = useState<"general" | "keys" | "hud">("general");
  const [mappingKey, setMappingKey] = useState<keyof KeyMap | null>(null);

  const startKeyBind = (field: keyof KeyMap) => {
    setMappingKey(field);
    const listener = (e: KeyboardEvent) => {
      e.preventDefault();
      const nextMap = { ...s.keyMap, [field]: e.code };
      set({ keyMap: nextMap });
      setMappingKey(null);
      window.removeEventListener("keydown", listener);
    };
    window.addEventListener("keydown", listener);
  };

  const updateHudProp = (field: keyof HudCustomization, val: number) => {
    const nextHud = { ...s.hudCustom, [field]: Math.max(5, Math.min(95, val)) };
    set({ hudCustom: nextHud });
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-sm">
      <div className="panel pop w-[min(96vw,560px)] p-4 max-h-[92vh] overflow-y-auto scrollbar">
        <div className="flex items-center mb-3">
          <div className="pixel tshadow text-2xl text-[#b6f04a]">SETTINGS</div>
          <button onClick={onClose} className="btn pixel ml-auto px-3 py-1 text-[10px] text-white">CLOSE ✕</button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#2c3644] mb-3">
          {(["general", "keys", "hud"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className="pixel flex-1 py-2 text-center text-[10px] transition-colors"
              style={{
                color: tab === t ? "#b6f04a" : "#7f8ea0",
                borderBottom: tab === t ? "2px solid #b6f04a" : "none"
              }}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {tab === "general" && (
          <div className="flex flex-col divide-y divide-[#1e2732]">
            <Row label="CALLSIGN">
              <input
                value={s.name}
                maxLength={12}
                onChange={(e) => set({ name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })}
                className="pixel w-full border-2 border-[#2c3644] bg-black/50 px-2 py-1 text-[11px] text-white outline-none focus:border-[#b6f04a]"
              />
            </Row>
            <Row label="CONTROLS">
              {(["pc", "mobile"] as ControlMode[]).map((m) => (
                <button key={m} onClick={() => set({ controlMode: m })} className="btn pixel flex-1 px-2 py-1 text-[10px]"
                  style={{ borderColor: s.controlMode === m ? "#b6f04a" : "#3a4657", color: s.controlMode === m ? "#b6f04a" : "#8fa3b6" }}>
                  {m === "pc" ? "PC" : "MOBILE"}
                </button>
              ))}
            </Row>
            <Row label="ASK EACH TIME">
              <Toggle on={!s.rememberControls} onClick={() => set({ rememberControls: !s.rememberControls })} labels={["NO", "YES"]} />
            </Row>
            <Row label="MOUSE SENS">
              <input type="range" min={0.1} max={4.0} step={0.05} value={s.sens} onChange={(e) => set({ sens: +e.target.value })} className="w-full accent-[#b6f04a]" />
              <span className="pixel w-10 text-right text-[10px] text-white">{s.sens.toFixed(2)}</span>
            </Row>
            <Row label="TOUCH SENS">
              <input type="range" min={0.1} max={4.0} step={0.05} value={s.touchSens} onChange={(e) => set({ touchSens: +e.target.value })} className="w-full accent-[#b6f04a]" />
              <span className="pixel w-10 text-right text-[10px] text-white">{s.touchSens.toFixed(2)}</span>
            </Row>
            <Row label="INVERT Y"><Toggle on={s.invertY} onClick={() => set({ invertY: !s.invertY })} /></Row>
            <Row label="MASTER VOL">
              <input type="range" min={0} max={1} step={0.05} value={s.masterVolume} onChange={(e) => set({ masterVolume: +e.target.value, muted: false })} className="w-full accent-[#b6f04a]" />
              <span className="pixel w-10 text-right text-[10px] text-white">{Math.round(s.masterVolume * 100)}%</span>
            </Row>
            <Row label="SFX VOL">
              <input type="range" min={0} max={1} step={0.05} value={s.sfxVolume} onChange={(e) => set({ sfxVolume: +e.target.value, muted: false })} className="w-full accent-[#b6f04a]" />
              <span className="pixel w-10 text-right text-[10px] text-white">{Math.round(s.sfxVolume * 100)}%</span>
            </Row>
            <Row label="MUSIC VOL">
              <input type="range" min={0} max={1} step={0.05} value={s.bgmVolume} onChange={(e) => set({ bgmVolume: +e.target.value, muted: false })} className="w-full accent-[#b6f04a]" />
              <span className="pixel w-10 text-right text-[10px] text-white">{Math.round(s.bgmVolume * 100)}%</span>
            </Row>
            <Row label="SHOW FPS"><Toggle on={s.showFps} onClick={() => set({ showFps: !s.showFps })} /></Row>
            <Row label="GRAPHICS">
              {(["low", "med", "high"] as const).map((q) => (
                <button key={q} onClick={() => set({ quality: q })} className="btn pixel flex-1 px-2 py-1 text-[10px]"
                  style={{ borderColor: s.quality === q ? "#b6f04a" : "#3a4657", color: s.quality === q ? "#b6f04a" : "#8fa3b6" }}>
                  {q.toUpperCase()}
                </button>
              ))}
            </Row>
          </div>
        )}

        {tab === "keys" && (
          <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto scrollbar pr-1">
            <div className="pixel text-[9px] text-[#7f8ea0] mb-1">CLICK ON A ROW TO REBIND KEY:</div>
            {(Object.keys(s.keyMap) as Array<keyof KeyMap>).map((field) => (
              <button key={field} onClick={() => startKeyBind(field)} className="flex items-center justify-between border-2 border-[#1e2732] hover:border-[#b6f04a] bg-black/40 px-3 py-2 text-left">
                <span className="pixel text-[10px] text-[#cfe0ee]">{field.toUpperCase()}</span>
                <span className="pixel text-[10px] text-[#b6f04a]">
                  {mappingKey === field ? "PRESS ANY KEY…" : s.keyMap[field] || "NONE"}
                </span>
              </button>
            ))}
            <button onClick={() => set({ keyMap: DEFAULT_KEYMAP })} className="btn pixel py-2 text-[10px] text-white mt-2">
              RESET KEY BINDINGS TO DEFAULT
            </button>
          </div>
        )}

        {tab === "hud" && (
          <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto scrollbar pr-1">
            <div className="pixel text-[9px] text-[#7f8ea0]">MOBILE HUD SETTINGS & BUTTON SIZES</div>
            <Row label="HUD SCALE">
              <input type="range" min={0.6} max={1.5} step={0.05} value={s.hudScale} onChange={(e) => set({ hudScale: +e.target.value })} className="w-full accent-[#b6f04a]" />
              <span className="pixel w-10 text-right text-[10px] text-white">{Math.round(s.hudScale * 100)}%</span>
            </Row>
            <Row label="HUD OPACITY">
              <input type="range" min={0.2} max={1.0} step={0.05} value={s.hudOpacity} onChange={(e) => set({ hudOpacity: +e.target.value })} className="w-full accent-[#b6f04a]" />
              <span className="pixel w-10 text-right text-[10px] text-white">{Math.round(s.hudOpacity * 100)}%</span>
            </Row>

            <div className="border-t border-[#1e2732] pt-2">
              <div className="pixel text-[9px] text-[#7f8ea0] mb-2">CUSTOM BUTTON LAYOUT SLIDERS</div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="pixel text-[9px] text-[#8fa3b6] w-24">FIRE BTN X</span>
                  <input type="range" min={5} max={95} value={s.hudCustom.fireButtonX} onChange={(e) => updateHudProp("fireButtonX", +e.target.value)} className="flex-1 accent-[#b6f04a]" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="pixel text-[9px] text-[#8fa3b6] w-24">FIRE BTN Y</span>
                  <input type="range" min={5} max={95} value={s.hudCustom.fireButtonY} onChange={(e) => updateHudProp("fireButtonY", +e.target.value)} className="flex-1 accent-[#b6f04a]" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="pixel text-[9px] text-[#8fa3b6] w-24">AIM BTN X</span>
                  <input type="range" min={5} max={95} value={s.hudCustom.aimButtonX} onChange={(e) => updateHudProp("aimButtonX", +e.target.value)} className="flex-1 accent-[#b6f04a]" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="pixel text-[9px] text-[#8fa3b6] w-24">AIM BTN Y</span>
                  <input type="range" min={5} max={95} value={s.hudCustom.aimButtonY} onChange={(e) => updateHudProp("aimButtonY", +e.target.value)} className="flex-1 accent-[#b6f04a]" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="pixel text-[9px] text-[#8fa3b6] w-24">JUMP BTN X</span>
                  <input type="range" min={5} max={95} value={s.hudCustom.jumpButtonX} onChange={(e) => updateHudProp("jumpButtonX", +e.target.value)} className="flex-1 accent-[#b6f04a]" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="pixel text-[9px] text-[#8fa3b6] w-24">JUMP BTN Y</span>
                  <input type="range" min={5} max={95} value={s.hudCustom.jumpButtonY} onChange={(e) => updateHudProp("jumpButtonY", +e.target.value)} className="flex-1 accent-[#b6f04a]" />
                </div>
              </div>
            </div>

            <button onClick={() => set({ hudCustom: DEFAULT_HUD })} className="btn pixel py-2 text-[10px] text-white mt-2">
              RESET HUD LAYOUT TO DEFAULT
            </button>
          </div>
        )}

        <div className="pixel mt-3 text-[9px] text-[#4f5c6b]">
          {inGame ? "PVP IS LOCKED WHILE A MATCH IS RUNNING." : "ALL SETTINGS SAVE AUTOMATICALLY TO THIS DEVICE."}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------- coming soon -------------------------------------------------- */
export function ComingSoonPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
      <div className="panel pop w-[min(96vw,480px)] p-5 text-center">
        <div className="pixel tshadow text-3xl text-[#4dd2ff]">COMING SOON</div>
        <div className="pixel mt-2 text-[#b6f04a] text-xs">REALISTIC 3D GRAPHICS EDITION</div>
        <p className="pixel mt-4 text-[10px] leading-relaxed text-[#8fa3b6]">
          We are building the next generation of Blockfront with ultra-realistic physics, realistic 3D textures, dynamic ray-traced shadows, interactive foliage, and highly customizable attachment systems!
        </p>
        <div className="mt-5 border-2 border-dashed border-[#2c3644] p-3 rounded bg-black/40">
          <div className="pixel text-[9px] text-[#7f8ea0]">CURRENT FOCUS:</div>
          <div className="pixel text-[11px] text-white mt-1">✓ MULTIPLAYER CO-OP · ✓ VEHICLES · ✓ DESTRUCTIBLE GEOMETRY</div>
        </div>
        <button onClick={onClose} className="btn btn-go pixel mt-5 w-full py-3 text-sm">EXCELLENT, UNDERSTOOD!</button>
      </div>
    </div>
  );
}

/* --------------------------------------------------- lobby ---------------------------------------------------- */
export interface LobbyProps {
  status: NetStatus;
  players: NetPlayer[];
  meta: RoomMeta;
  isHost: boolean;
  inRoom: boolean;
  myId: string;
  code: string;
  error: string;
  recent: RecentRoom[];
  settings: Settings;
  onCreate: (maxPlayers: number, pvp: boolean) => void;
  onJoin: (code: string) => void;
  onLeave: () => void;
  onStartMatch: () => void;
  onSetMeta: (p: Partial<RoomMeta>) => void;
  onBack: () => void;
}

export function LobbyScreen(p: LobbyProps) {
  const [code, setCode] = useState("");
  const [size, setSize] = useState(p.settings.maxPlayers);
  const [pvp, setPvp] = useState(p.settings.pvp);
  const busy = p.status === "creating" || p.status === "joining" || p.status === "migrating";

  return (
    <div className="scrollbar absolute inset-0 overflow-y-auto bg-[#0b0e13]/92">
      <div className="scan pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex min-h-full w-full max-w-3xl flex-col gap-3 p-3 sm:p-6">
        <div className="flex items-center gap-2">
          <button onClick={p.inRoom ? p.onLeave : p.onBack} className="btn pixel px-3 py-2 text-[10px] text-white">◀ {p.inRoom ? "LEAVE" : "BACK"}</button>
          <div className="pixel tshadow flex-1 text-center text-xl text-[#b6f04a] sm:text-3xl">MULTIPLAYER</div>
          <div className="pixel w-16 text-right text-[9px]" style={{ color: p.status === "hosting" || p.status === "connected" ? "#b6f04a" : "#7f8ea0" }}>
            {p.status.toUpperCase()}
          </div>
        </div>

        {p.error && <div className="pixel border-2 border-[#ff4d5e]/60 bg-[#ff4d5e]/10 px-3 py-2 text-[10px] text-[#ff8a9b]">{p.error}</div>}
        {p.status === "migrating" && (
          <div className="pixel border-2 border-[#ffc23f]/60 bg-[#ffc23f]/10 px-3 py-2 text-[10px] text-[#ffd76a]">
            HOST LEFT — MIGRATING ROOM TO A NEW HOST…
          </div>
        )}

        {!p.inRoom ? (
          <div className="grid gap-3 md:grid-cols-2">
            {/* create */}
            <div className="panel p-4">
              <div className="pixel text-sm text-white">CREATE ROOM</div>
              <div className="pixel mt-1 text-[9px] text-[#7f8ea0]">YOU BECOME THE HOST</div>
              <div className="mt-3">
                <div className="pixel flex items-center justify-between text-[10px] text-[#8fa3b6]">
                  <span>ROOM SIZE</span><span className="text-[#b6f04a]">{size} PLAYERS</span>
                </div>
                <input type="range" min={2} max={10} step={1} value={size} onChange={(e) => setSize(+e.target.value)} className="mt-1 w-full accent-[#b6f04a]" />
                <div className="pixel flex justify-between text-[8px] text-[#4f5c6b]"><span>2</span><span>10 (DEFAULT)</span></div>
                <div className="pixel mt-1 text-[9px] text-[#4f5c6b]">INCLUDES YOU — {size - 1} SLOT{size - 1 === 1 ? "" : "S"} FOR OTHERS</div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="pixel text-[10px] text-[#8fa3b6]">PVP FRIENDLY FIRE</span>
                <Toggle on={pvp} onClick={() => setPvp(!pvp)} />
              </div>
              <button disabled={busy} onClick={() => p.onCreate(size, pvp)} className="btn btn-go pixel mt-4 w-full py-3 text-sm disabled:opacity-50">
                {busy ? "…" : "CREATE ▶"}
              </button>
            </div>

            {/* join */}
            <div className="panel p-4">
              <div className="pixel text-sm text-white">JOIN ROOM</div>
              <div className="pixel mt-1 text-[9px] text-[#7f8ea0]">ENTER A 5-CHARACTER CODE</div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
                placeholder="ABC12"
                className="pixel mt-3 w-full border-2 border-[#2c3644] bg-black/50 px-3 py-3 text-center text-2xl tracking-[0.3em] text-white outline-none focus:border-[#b6f04a]"
              />
              <button disabled={busy || code.length < 3} onClick={() => p.onJoin(code)} className="btn pixel mt-3 w-full py-3 text-sm text-white disabled:opacity-40">
                JOIN ▶
              </button>
              <div className="pixel mt-4 text-[10px] text-[#7f8ea0]">RECENT ROOMS</div>
              {p.recent.length === 0 ? (
                <div className="pixel mt-1 text-[9px] text-[#4f5c6b]">NO RECENT ROOMS YET</div>
              ) : (
                <div className="mt-1 flex flex-col gap-1">
                  {p.recent.map((r) => (
                    <button key={r.code} onClick={() => p.onJoin(r.code)} className="btn pixel flex items-center gap-2 px-2 py-2 text-[11px] text-white">
                      <span className="tracking-[0.2em] text-[#4dd2ff]">{r.code}</span>
                      <span className="ml-auto text-[8px] text-[#4f5c6b]">{new Date(r.at).toLocaleDateString()}</span>
                      <span className="text-[9px] text-[#b6f04a]">REJOIN ▶</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
            <div className="panel p-4">
              <div className="pixel text-[10px] text-[#7f8ea0]">ROOM CODE — SHARE IT</div>
              <div className="flex items-center gap-2">
                <div className="pixel tshadow text-4xl tracking-[0.25em] text-[#4dd2ff] sm:text-5xl">{p.code}</div>
                <button
                  onClick={() => navigator.clipboard?.writeText(p.code)}
                  className="btn pixel ml-auto px-2 py-1 text-[9px] text-white">COPY</button>
              </div>
              <div className="pixel mt-3 flex items-center justify-between text-[10px] text-[#8fa3b6]">
                <span>PLAYERS</span>
                <span className="text-[#b6f04a]">{p.players.length} / {p.meta.maxPlayers}</span>
              </div>
              <div className="mt-2 flex flex-col gap-1">
                {p.players.map((pl) => (
                  <div key={pl.id} className="pixel flex items-center gap-2 border-2 border-[#1e2732] bg-black/30 px-2 py-1 text-[10px]"
                    style={{ color: pl.id === p.myId ? "#b6f04a" : "#cfe0ee" }}>
                    <span>{pl.host ? "★" : "·"}</span>
                    <span className="flex-1 truncate">{pl.name}{pl.id === p.myId ? " (YOU)" : ""}</span>
                    <span className="text-[8px] text-[#4f5c6b]">{pl.host ? "HOST" : "READY"}</span>
                  </div>
                ))}
                {Array.from({ length: Math.max(0, p.meta.maxPlayers - p.players.length) }).slice(0, 4).map((_, i) => (
                  <div key={i} className="pixel border-2 border-dashed border-[#1e2732] px-2 py-1 text-[10px] text-[#3a4657]">EMPTY SLOT</div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="panel p-4">
                <div className="pixel text-sm text-white">MATCH RULES</div>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <div className="pixel text-[10px] text-[#8fa3b6]">PVP FRIENDLY FIRE</div>
                    <div className="pixel text-[8px] text-[#4f5c6b]">LOCKED ONCE THE MATCH STARTS</div>
                  </div>
                  {p.isHost ? (
                    <Toggle on={p.meta.pvp} onClick={() => p.onSetMeta({ pvp: !p.meta.pvp })} />
                  ) : (
                    <span className="pixel text-[10px]" style={{ color: p.meta.pvp ? "#ff4d5e" : "#7f8ea0" }}>{p.meta.pvp ? "ON" : "OFF"}</span>
                  )}
                </div>
                {p.isHost && (
                  <div className="mt-3">
                    <div className="pixel flex items-center justify-between text-[10px] text-[#8fa3b6]">
                      <span>ROOM SIZE</span><span className="text-[#b6f04a]">{p.meta.maxPlayers}</span>
                    </div>
                    <input type="range" min={Math.max(2, p.players.length)} max={10} step={1} value={p.meta.maxPlayers}
                      onChange={(e) => p.onSetMeta({ maxPlayers: +e.target.value })} className="mt-1 w-full accent-[#b6f04a]" />
                  </div>
                )}
                <div className="pixel mt-3 text-[9px] text-[#4f5c6b]">
                  CO-OP WAVES + AI ENEMIES ARE SYNCED BY THE HOST. IF THE HOST LEAVES, THE ROOM AUTOMATICALLY MIGRATES.
                </div>
              </div>

              <button onClick={p.onStartMatch} className="btn btn-go glow pixel py-4 text-lg">
                {p.isHost ? "START MATCH ▶" : "DROP IN ▶"}
              </button>
              <div className="pixel text-center text-[9px] text-[#4f5c6b]">
                {p.isHost ? "OTHERS CAN JOIN AT ANY TIME" : "YOU CAN DROP IN WHENEVER YOU'RE READY"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
