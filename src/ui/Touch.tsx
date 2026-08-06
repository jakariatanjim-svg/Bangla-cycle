import { useEffect, useRef, useState } from "react";
import type { Game } from "../game/engine";
import { type Settings, DEFAULT_HUD } from "../game/settings";

const R = 56;

function Btn({
  label, onDown, onUp, active, big, style = {}, opacity = 1.0, scale = 1.0,
}: { label: string; onDown: () => void; onUp?: () => void; active?: boolean; big?: boolean; style?: React.CSSProperties; opacity?: number; scale?: number }) {
  const size = big ? 104 * scale : 62 * scale;
  return (
    <div
      className="pixel flex select-none flex-col items-center justify-center rounded-full border-[3px] text-center backdrop-blur-sm pointer-events-auto absolute"
      style={{
        width: size, height: size,
        borderColor: active ? "#b6f04a" : "rgba(255,255,255,0.35)",
        background: active ? "rgba(182,240,74,0.25)" : "rgba(8,12,18,0.45)",
        color: active ? "#d9ff9a" : "#dfeaf4",
        opacity: opacity,
        transform: "translate(-50%, -50%)",
        ...style,
      }}
      onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); onDown(); }}
      onTouchEnd={(e) => { e.stopPropagation(); onUp?.(); }}
      onTouchCancel={(e) => { e.stopPropagation(); onUp?.(); }}
    >
      <span className="font-bold tracking-tight" style={{ fontSize: `${(big ? 13 : 9) * scale}px` }}>{label}</span>
    </div>
  );
}

export function TouchControls({ game, onPause, settings }: { game: Game; onPause: () => void; settings: Settings }) {
  const knobRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const moveId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const lastLook = useRef({ x: 0, y: 0 });
  
  const [ads, setAds] = useState(false);
  const [sprint, setSprint] = useState(false);
  const [firing, setFiring] = useState(false);
  const [crouch, setCrouch] = useState(false);

  useEffect(() => () => { game.touch.mx = 0; game.touch.my = 0; game.touch.fire = false; }, [game]);

  const setStick = (dx: number, dy: number) => {
    const d = Math.hypot(dx, dy);
    const k = d > R ? R / d : 1;
    const x = dx * k, y = dy * k;
    if (knobRef.current) knobRef.current.style.transform = `translate(${x}px, ${y}px)`;
    game.touch.mx = x / R;
    game.touch.my = y / R;
  };

  const onStart = (e: React.TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      const half = window.innerWidth * 0.45;
      if (t.clientX < half && moveId.current === null) {
        moveId.current = t.identifier;
        origin.current = { x: t.clientX, y: t.clientY };
        if (baseRef.current) {
          baseRef.current.style.left = `${t.clientX}px`;
          baseRef.current.style.top = `${t.clientY}px`;
          baseRef.current.style.opacity = "1";
        }
        setStick(0, 0);
      } else if (lookId.current === null) {
        lookId.current = t.identifier;
        lastLook.current = { x: t.clientX, y: t.clientY };
      }
    }
  };
  const onMove = (e: React.TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === moveId.current) setStick(t.clientX - origin.current.x, t.clientY - origin.current.y);
      else if (t.identifier === lookId.current) {
        game.touchLook(t.clientX - lastLook.current.x, t.clientY - lastLook.current.y);
        lastLook.current = { x: t.clientX, y: t.clientY };
      }
    }
  };
  const onEnd = (e: React.TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === moveId.current) {
        moveId.current = null;
        game.touch.mx = 0; game.touch.my = 0;
        if (knobRef.current) knobRef.current.style.transform = "translate(0,0)";
        if (baseRef.current) baseRef.current.style.opacity = "0.35";
      } else if (t.identifier === lookId.current) lookId.current = null;
    }
  };

  const op = settings.hudOpacity ?? 0.85;
  const sc = settings.hudScale ?? 1.0;
  const layout = settings.hudCustom ?? DEFAULT_HUD;

  return (
    <div className="absolute inset-0 touch-none" onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}>
      {/* Joystick base positioned customized or bottom-left */}
      <div
        ref={baseRef}
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/25 bg-black/25 pointer-events-auto"
        style={{
          width: R * 2 * sc, height: R * 2 * sc,
          left: `${layout.leftStickX ?? 15}%`,
          top: `${layout.leftStickY ?? 72}%`,
          opacity: op * 0.5,
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div ref={knobRef} className="rounded-full border-[3px] border-[#b6f04a]/70 bg-[#b6f04a]/25" style={{ width: 52 * sc, height: 52 * sc }} />
        </div>
      </div>

      {/* Action Fire button */}
      <Btn
        label="FIRE" big active={firing} opacity={op} scale={sc}
        style={{ left: `${layout.fireButtonX}%`, top: `${layout.fireButtonY}%` }}
        onDown={() => { setFiring(true); game.touch.fire = true; game.tryFire(); }}
        onUp={() => { setFiring(false); game.touch.fire = false; }}
      />

      {/* Aim Scope button */}
      <Btn
        label="ADS" active={ads} opacity={op} scale={sc}
        style={{ left: `${layout.aimButtonX}%`, top: `${layout.aimButtonY}%` }}
        onDown={() => { const v = !ads; setAds(v); game.touch.ads = v; }}
      />

      {/* Jump button */}
      <Btn
        label="JUMP" opacity={op} scale={sc}
        style={{ left: `${layout.jumpButtonX}%`, top: `${layout.jumpButtonY}%` }}
        onDown={() => { game.touch.jump = true; }}
      />

      {/* Crouch & Slide button */}
      <Btn
        label="SLIDE" active={crouch} opacity={op} scale={sc}
        style={{ left: `${layout.crouchButtonX}%`, top: `${layout.crouchButtonY}%` }}
        onDown={() => { const v = !crouch; setCrouch(v); game.touch.crouch = v; }}
        onUp={() => { setCrouch(false); game.touch.crouch = false; }}
      />

      {/* Grenade button */}
      <Btn
        label="NADE" opacity={op} scale={sc}
        style={{ left: `${layout.grenadeButtonX}%`, top: `${layout.grenadeButtonY}%` }}
        onDown={() => { game.touch.nade = true; }}
      />

      {/* Reload button */}
      <Btn
        label="RELOAD" opacity={op} scale={sc}
        style={{ left: `${layout.reloadButtonX}%`, top: `${layout.reloadButtonY}%` }}
        onDown={() => game.startReload()}
      />

      {/* Swap slot button */}
      <Btn
        label="SWAP" opacity={op} scale={sc}
        style={{ left: `${layout.swapButtonX}%`, top: `${layout.swapButtonY}%` }}
        onDown={() => game.swap()}
      />

      {/* Sprint lock toggle */}
      <Btn
        label="RUN" active={sprint} opacity={op} scale={sc * 0.85}
        style={{ left: `${(layout.leftStickX ?? 15) + 6}%`, top: `${(layout.leftStickY ?? 72) - 16}%` }}
        onDown={() => { const v = !sprint; setSprint(v); game.touch.sprint = v; }}
      />

      <div className="absolute right-3 top-3 pointer-events-auto">
        <div
          className="pixel border-[3px] border-white/30 bg-black/45 px-3 py-2 text-[10px]"
          onTouchStart={(e) => { e.stopPropagation(); onPause(); }}
        >
          ❚❚
        </div>
      </div>
    </div>
  );
}
