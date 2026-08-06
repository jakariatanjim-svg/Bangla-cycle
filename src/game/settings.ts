export type ControlMode = "pc" | "mobile";

export interface KeyMap {
  forward: string;
  backward: string;
  left: string;
  right: string;
  jump: string;
  crouch: string;
  reload: string;
  grenade: string;
  swap: string;
}

export interface HudCustomization {
  leftStickX: number; // percentage from left
  leftStickY: number; // percentage from top
  fireButtonX: number;
  fireButtonY: number;
  aimButtonX: number;
  aimButtonY: number;
  jumpButtonX: number;
  jumpButtonY: number;
  crouchButtonX: number;
  crouchButtonY: number;
  grenadeButtonX: number;
  grenadeButtonY: number;
  reloadButtonX: number;
  reloadButtonY: number;
  swapButtonX: number;
  swapButtonY: number;
}

export interface Settings {
  controlMode: ControlMode | null;
  rememberControls: boolean;
  name: string;
  sens: number;        // mouse sensitivity multiplier
  touchSens: number;   // touch look multiplier
  invertY: boolean;
  muted: boolean;
  masterVolume: number; // 0..1
  bgmVolume: number;    // 0..1
  sfxVolume: number;    // 0..1
  showFps: boolean;
  quality: "low" | "med" | "high";
  pvp: boolean;        // host preference
  maxPlayers: number;  // host preference (2..10)
  keyMap: KeyMap;
  hudCustom: HudCustomization;
  hudOpacity: number;  // 0.2 .. 1.0
  hudScale: number;    // 0.6 .. 1.5
}

const KEY = "blockfront.settings.v1";
const ROOMS = "blockfront.recentrooms.v1";

const randName = () => "PLAYER" + Math.floor(100 + Math.random() * 900);

export const DEFAULT_KEYMAP: KeyMap = {
  forward: "KeyW",
  backward: "KeyS",
  left: "KeyA",
  right: "KeyD",
  jump: "Space",
  crouch: "KeyC",
  reload: "KeyR",
  grenade: "KeyG",
  swap: "KeyQ",
};

export const DEFAULT_HUD: HudCustomization = {
  leftStickX: 15,
  leftStickY: 72,
  fireButtonX: 84,
  fireButtonY: 72,
  aimButtonX: 72,
  aimButtonY: 76,
  jumpButtonX: 92,
  jumpButtonY: 54,
  crouchButtonX: 82,
  crouchButtonY: 54,
  grenadeButtonX: 72,
  grenadeButtonY: 56,
  reloadButtonX: 92,
  reloadButtonY: 34,
  swapButtonX: 80,
  swapButtonY: 34,
};

export const DEFAULT_SETTINGS: Settings = {
  controlMode: null,
  rememberControls: false,
  name: randName(),
  sens: 1.0,
  touchSens: 1.0,
  invertY: false,
  muted: false,
  masterVolume: 0.85,
  bgmVolume: 0.45,
  sfxVolume: 0.75,
  showFps: true,
  quality: "high",
  pvp: false,
  maxPlayers: 10,
  keyMap: DEFAULT_KEYMAP,
  hudCustom: DEFAULT_HUD,
  hudOpacity: 0.85,
  hudScale: 1.0,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const s = JSON.parse(raw) as Partial<Settings>;
    const merged: Settings = {
      ...DEFAULT_SETTINGS,
      ...s,
      keyMap: { ...DEFAULT_KEYMAP, ...s.keyMap },
      hudCustom: { ...DEFAULT_HUD, ...s.hudCustom },
    };
    merged.maxPlayers = Math.max(2, Math.min(10, Math.round(merged.maxPlayers || 10)));
    merged.sens = Math.max(0.1, Math.min(5, merged.sens || 1.0));
    merged.touchSens = Math.max(0.1, Math.min(5, merged.touchSens || 1.0));
    merged.masterVolume = Math.max(0, Math.min(1, merged.masterVolume ?? 0.85));
    merged.bgmVolume = Math.max(0, Math.min(1, merged.bgmVolume ?? 0.45));
    merged.sfxVolume = Math.max(0, Math.min(1, merged.sfxVolume ?? 0.75));
    merged.hudOpacity = Math.max(0.2, Math.min(1.0, merged.hudOpacity ?? 0.85));
    merged.hudScale = Math.max(0.5, Math.min(2.0, merged.hudScale ?? 1.0));
    if (merged.controlMode !== "pc" && merged.controlMode !== "mobile") merged.controlMode = null;
    if (!merged.name) merged.name = randName();
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/* ---- recent rooms (last 3) ---- */
export interface RecentRoom { code: string; at: number }

export function loadRecentRooms(): RecentRoom[] {
  try {
    const raw = localStorage.getItem(ROOMS);
    if (!raw) return [];
    const a = JSON.parse(raw);
    if (!Array.isArray(a)) return [];
    return a
      .filter((r: RecentRoom) => r && typeof r.code === "string")
      .slice(0, 3);
  } catch { return []; }
}

export function pushRecentRoom(code: string): RecentRoom[] {
  const c = code.toUpperCase().trim();
  if (!c) return loadRecentRooms();
  const list = [{ code: c, at: Date.now() }, ...loadRecentRooms().filter((r) => r.code !== c)].slice(0, 3);
  try { localStorage.setItem(ROOMS, JSON.stringify(list)); } catch { /* ignore */ }
  return list;
}

export function clearRecentRooms(): RecentRoom[] {
  try { localStorage.removeItem(ROOMS); } catch { /* ignore */ }
  return [];
}

export function makeRoomCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += A[(Math.random() * A.length) | 0];
  return s;
}
