// Complete collection of 16 weapons + weapon attachments and builders
export type Part = [number, number, number, number, number, number, number]; // x,y,z,sx,sy,sz,color

export type WClass = "AR" | "SMG" | "SNIPER" | "PISTOL" | "LMG";

export interface Attachments {
  scope: "none" | "red" | "holo" | "2x" | "3x" | "4x" | "6x" | "8x";
  magazine: "default" | "extended" | "quickdraw";
  muzzle: "none" | "suppressor" | "compensator" | "flashHider";
}

export interface Shape {
  body: number; // receiver length
  bodyH?: number;
  barrel: number;
  barrelW?: number;
  stock?: "none" | "fixed" | "skel" | "fold" | "sniper";
  mag?: "none" | "straight" | "curved" | "long" | "top" | "drum" | "pistol";
  scope?: "none" | "red" | "holo" | "small" | "big";
  can?: boolean; // suppressor
  grip?: boolean;
  metal?: number;
  wood?: number;
  accent?: number;
}

export interface Weapon {
  id: string;
  name: string;
  cls: WClass;
  dmg: number;
  head: number; // headshot multiplier
  rpm: number;
  mag: number;
  reload: number;
  auto: boolean;
  spread: number; // hipfire degrees
  adsSpread: number;
  recoil: number;
  zoom: number;
  pierce: number;
  kick: number; // visual kick
  shake: number;
  quiet?: boolean;
  tone: number; // audio base freq
  boom: number; // audio body
  tracer: number;
  shape: Shape;
  blurb: string;
}

const STEEL = 0x2e3238;
const DARK = 0x1a1c1e;
const TAN = 0x9e876c;
const WOOD = 0x5a3c1f;
const BLACK = 0x0f1011;
const GREY = 0x4a5057;

export const WEAPONS: Weapon[] = [
  {
    id: "akm", name: "AKM", cls: "AR", dmg: 47, head: 3.2, rpm: 600, mag: 30, reload: 2.5,
    auto: true, spread: 2.2, adsSpread: 0.5, recoil: 1.85, zoom: 1.35, pierce: 1, kick: 1.6, shake: 0.95,
    tone: 135, boom: 0.32, tracer: 0xffa050,
    shape: { body: 0.62, barrel: 0.38, stock: "fixed", mag: "curved", scope: "none", grip: false, metal: STEEL, wood: WOOD, accent: WOOD },
    blurb: "Devastating close-to-mid range damage. High climb rate.",
  },
  {
    id: "m416", name: "M416", cls: "AR", dmg: 41, head: 3, rpm: 700, mag: 30, reload: 2.1,
    auto: true, spread: 1.7, adsSpread: 0.32, recoil: 1.05, zoom: 1.4, pierce: 1, kick: 0.95, shake: 0.55,
    tone: 190, boom: 0.2, tracer: 0xffd280,
    shape: { body: 0.65, barrel: 0.32, stock: "fixed", mag: "straight", scope: "red", grip: true, metal: DARK, accent: GREY },
    blurb: "Excellent stability and accuracy. The versatile champion.",
  },
  {
    id: "scarl", name: "SCAR-L", cls: "AR", dmg: 41, head: 3, rpm: 625, mag: 30, reload: 2.3,
    auto: true, spread: 1.8, adsSpread: 0.35, recoil: 1.15, zoom: 1.4, pierce: 1, kick: 1.05, shake: 0.6,
    tone: 175, boom: 0.22, tracer: 0xffe290,
    shape: { body: 0.66, barrel: 0.35, stock: "fold", mag: "straight", scope: "small", grip: true, metal: TAN, accent: TAN },
    blurb: "Reliable and easy to control. Highly stable full-auto spray.",
  },
  {
    id: "m16a4", name: "M16A4", cls: "AR", dmg: 43, head: 3, rpm: 800, mag: 30, reload: 2.2,
    auto: false, spread: 1.6, adsSpread: 0.28, recoil: 1.25, zoom: 1.45, pierce: 1, kick: 0.85, shake: 0.5,
    tone: 200, boom: 0.18, tracer: 0xfff0b0,
    shape: { body: 0.68, barrel: 0.42, stock: "fixed", mag: "straight", scope: "none", grip: false, metal: STEEL, accent: GREY },
    blurb: "Highly accurate burst weapon. Deadly in rapid hands.",
  },
  {
    id: "aug", name: "AUG", cls: "AR", dmg: 42, head: 3, rpm: 750, mag: 30, reload: 2.4,
    auto: true, spread: 1.5, adsSpread: 0.3, recoil: 0.95, zoom: 1.5, pierce: 1, kick: 0.8, shake: 0.45,
    tone: 215, boom: 0.21, tracer: 0xd2ffd2,
    shape: { body: 0.58, barrel: 0.38, stock: "none", mag: "straight", scope: "small", grip: true, metal: 0x3d4f33, accent: DARK },
    blurb: "Bullpup layout. Superior handling and minimal recoil.",
  },
  {
    id: "groza", name: "GROZA", cls: "AR", dmg: 48, head: 3, rpm: 750, mag: 30, reload: 2.6,
    auto: true, spread: 2.0, adsSpread: 0.45, recoil: 1.45, zoom: 1.3, pierce: 1, kick: 1.35, shake: 0.8,
    tone: 155, boom: 0.28, tracer: 0xff9944,
    shape: { body: 0.52, barrel: 0.24, stock: "none", mag: "curved", scope: "none", grip: true, metal: DARK, accent: 0x22252a },
    blurb: "Unmatched fire rate and raw firepower. Massive recoil.",
  },
  {
    id: "awm", name: "AWM", cls: "SNIPER", dmg: 105, head: 3.5, rpm: 32, mag: 5, reload: 3.5,
    auto: false, spread: 7.5, adsSpread: 0.01, recoil: 4.5, zoom: 4.8, pierce: 3, kick: 3.6, shake: 2.5,
    tone: 85, boom: 0.75, tracer: 0xa0e0ff,
    shape: { body: 0.75, barrel: 0.58, stock: "sniper", mag: "straight", scope: "big", metal: 0x2e3d2f, accent: DARK },
    blurb: "Monstrous high-caliber power. One shot to the body kills.",
  },
  {
    id: "kar98k", name: "Kar98k", cls: "SNIPER", dmg: 79, head: 3.2, rpm: 36, mag: 5, reload: 3.2,
    auto: false, spread: 5.5, adsSpread: 0.02, recoil: 3.5, zoom: 4.0, pierce: 2, kick: 2.8, shake: 1.8,
    tone: 105, boom: 0.55, tracer: 0xffcc80,
    shape: { body: 0.72, barrel: 0.52, stock: "sniper", mag: "none", scope: "big", metal: STEEL, wood: WOOD, accent: WOOD },
    blurb: "Classic bolt-action infantry rifle. Deeply satisfying bolt cycle.",
  },
  {
    id: "m24", name: "M24", cls: "SNIPER", dmg: 84, head: 3.2, rpm: 40, mag: 5, reload: 3.0,
    auto: false, spread: 6.0, adsSpread: 0.02, recoil: 3.8, zoom: 4.2, pierce: 2, kick: 3.1, shake: 2.0,
    tone: 98, boom: 0.6, tracer: 0xfff0d2,
    shape: { body: 0.74, barrel: 0.55, stock: "sniper", mag: "straight", scope: "big", metal: DARK, accent: GREY },
    blurb: "Modernized bolt-action. Sleek design, higher muzzle velocity.",
  },
  {
    id: "ump45", name: "UMP45", cls: "SMG", dmg: 38, head: 2.5, rpm: 650, mag: 25, reload: 1.9,
    auto: true, spread: 1.8, adsSpread: 0.42, recoil: 0.75, zoom: 1.25, pierce: 1, kick: 0.65, shake: 0.4,
    tone: 200, boom: 0.16, tracer: 0xffe590,
    shape: { body: 0.48, barrel: 0.16, stock: "fold", mag: "straight", scope: "none", metal: BLACK, accent: GREY },
    blurb: "Extremely stable, easy to control. The close range gateway.",
  },
  {
    id: "vector", name: "VECTOR", cls: "SMG", dmg: 31, head: 2.4, rpm: 1100, mag: 19, reload: 1.7,
    auto: true, spread: 2.2, adsSpread: 0.48, recoil: 0.55, zoom: 1.25, pierce: 1, kick: 0.5, shake: 0.3,
    tone: 250, boom: 0.12, tracer: 0xb0e8ff,
    shape: { body: 0.42, bodyH: 0.18, barrel: 0.12, stock: "fold", mag: "long", scope: "red", metal: BLACK, accent: GREY },
    blurb: "Blistering cyclic rate. Empties the mag in milliseconds.",
  },
  {
    id: "mp5", name: "MP5", cls: "SMG", dmg: 33, head: 2.5, rpm: 800, mag: 30, reload: 2.0,
    auto: true, spread: 1.9, adsSpread: 0.44, recoil: 0.7, zoom: 1.3, pierce: 1, kick: 0.6, shake: 0.35,
    tone: 220, boom: 0.15, tracer: 0xfffec0,
    shape: { body: 0.46, barrel: 0.18, stock: "skel", mag: "curved", scope: "none", metal: STEEL, accent: DARK },
    blurb: "Incredible balance, modular construct, highly reliable.",
  },
  {
    id: "p90", name: "P90", cls: "SMG", dmg: 29, head: 2.4, rpm: 900, mag: 50, reload: 2.7,
    auto: true, spread: 2.1, adsSpread: 0.52, recoil: 0.65, zoom: 1.25, pierce: 1, kick: 0.55, shake: 0.35,
    tone: 235, boom: 0.13, tracer: 0xd0ffd0,
    shape: { body: 0.52, bodyH: 0.15, barrel: 0.1, stock: "none", mag: "top", scope: "red", metal: DARK, accent: GREY },
    blurb: "Extremely high capacity magazine with horizontal feed.",
  },
  {
    id: "thompson", name: "THOMPSON", cls: "SMG", dmg: 40, head: 2.6, rpm: 700, mag: 30, reload: 2.4,
    auto: true, spread: 2.4, adsSpread: 0.55, recoil: 1.1, zoom: 1.2, pierce: 1, kick: 0.95, shake: 0.6,
    tone: 160, boom: 0.22, tracer: 0xffba70,
    shape: { body: 0.55, barrel: 0.28, stock: "fixed", mag: "drum", scope: "none", metal: STEEL, wood: WOOD, accent: WOOD },
    blurb: "Venerable Tommy Gun. Exceptional close-quarters force.",
  },
  {
    id: "m249", name: "M249", cls: "LMG", dmg: 43, head: 3.0, rpm: 800, mag: 100, reload: 4.8,
    auto: true, spread: 3.2, adsSpread: 0.65, recoil: 1.6, zoom: 1.35, pierce: 2, kick: 1.5, shake: 1.1,
    tone: 180, boom: 0.35, tracer: 0xffe570,
    shape: { body: 0.72, bodyH: 0.18, barrel: 0.44, stock: "fixed", mag: "drum", scope: "none", grip: true, metal: STEEL, accent: GREY },
    blurb: "Laying continuous suppressive fire. Heavy belt-fed system.",
  },
  {
    id: "deagle", name: "D-EAGLE", cls: "PISTOL", dmg: 55, head: 3, rpm: 260, mag: 7, reload: 1.8,
    auto: false, spread: 2.4, adsSpread: 0.35, recoil: 2.8, zoom: 1.35, pierce: 2, kick: 2.4, shake: 1.4,
    tone: 125, boom: 0.45, tracer: 0xffca50,
    shape: { body: 0.28, bodyH: 0.16, barrel: 0.08, stock: "none", mag: "pistol", scope: "none", metal: STEEL, accent: DARK },
    blurb: "Massive hand cannon power. Exceptional stopping capability.",
  },
];

export const WMAP: Record<string, Weapon> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

/** Build detailed, attachment-aware voxel gun model */
export function buildParts(s: Shape, att?: Attachments): Part[] {
  const p: Part[] = [];
  const m = s.metal ?? STEEL;
  const a = s.accent ?? GREY;
  const h = s.bodyH ?? 0.14;
  const bl = s.body;

  // Resolve scope override from attachments
  let activeScope: "none" | "red" | "holo" | "small" | "big" = s.scope ?? "none";
  if (att) {
    if (att.scope === "red") activeScope = "red";
    else if (att.scope === "holo") activeScope = "holo";
    else if (att.scope === "2x" || att.scope === "3x" || att.scope === "4x") activeScope = "small";
    else if (att.scope === "6x" || att.scope === "8x") activeScope = "big";
  }

  // Resolve muzzle suppression/compensation
  let isSuppressed = s.can ?? false;
  let isCompensated = false;
  if (att) {
    if (att.muzzle === "suppressor") isSuppressed = true;
    else if (att.muzzle === "compensator" || att.muzzle === "flashHider") {
      isSuppressed = false;
      isCompensated = true;
    }
  }

  // Resolve magazine override
  let activeMag: "none" | "straight" | "curved" | "long" | "top" | "drum" | "pistol" = s.mag ?? "none";
  if (att && att.magazine !== "default") {
    if (activeMag === "straight" || activeMag === "curved") {
      activeMag = "long"; // longer mag for extended/quickdraw
    }
  }

  // Main Receiver Body
  p.push([0, 0, -bl / 2, 0.11, h, bl, m]);

  // Top Rail / Upper receiver
  p.push([0, h / 2 + 0.02, -bl / 2 + 0.02, 0.07, 0.04, bl * 0.8, a]);

  // Pistol Grip
  p.push([0, -h / 2 - 0.09, 0.02, 0.09, 0.2, 0.1, s.wood ?? BLACK]);

  // Trigger Guard
  p.push([0, -h / 2 - 0.05, -0.09, 0.05, 0.03, 0.12, m]);

  // Barrel
  const bw = s.barrelW ?? 0.05;
  if (s.barrel > 0) {
    p.push([0, 0.005, -bl - s.barrel / 2, bw, bw, s.barrel, 0x1b1e22]);
  }

  // Handguard
  if (s.barrel > 0.12) {
    p.push([0, -0.01, -bl - s.barrel * 0.34, 0.095, 0.1, s.barrel * 0.68, s.wood ?? a]);
  }

  // Muzzle attachment
  if (isSuppressed) {
    // Suppressor: Long sleek black tube
    p.push([0, 0.005, -bl - s.barrel - 0.13, 0.08, 0.08, 0.28, 0x111213]);
  } else if (isCompensated) {
    // Compensator: Flared metallic end
    p.push([0, 0.005, -bl - s.barrel - 0.05, 0.085, 0.085, 0.12, 0x5a606a]);
  }

  // Front grip attachment
  if (s.grip) {
    p.push([0, -h / 2 - 0.1, -bl - s.barrel * 0.5, 0.06, 0.16, 0.07, BLACK]);
  }

  // Magazines
  switch (activeMag) {
    case "straight":
      p.push([0, -h / 2 - 0.14, -bl * 0.55, 0.075, 0.28, 0.1, a]);
      break;
    case "long":
      p.push([0, -h / 2 - 0.22, -bl * 0.5, 0.07, 0.44, 0.09, a]);
      break;
    case "curved":
      p.push([0, -h / 2 - 0.11, -bl * 0.55, 0.075, 0.22, 0.11, a]);
      p.push([0, -h / 2 - 0.28, -bl * 0.62, 0.075, 0.2, 0.11, 0x151618]);
      break;
    case "top":
      p.push([0, h / 2 + 0.05, -bl * 0.62, 0.13, 0.09, bl * 0.6, a]);
      break;
    case "drum":
      p.push([0, -h / 2 - 0.16, -bl * 0.5, 0.14, 0.24, 0.24, BLACK]);
      break;
    case "pistol":
      p.push([0, -h / 2 - 0.1, 0.02, 0.07, 0.16, 0.08, a]);
      break;
  }

  // Buttstock
  switch (s.stock) {
    case "fixed":
      p.push([0, -0.01, 0.16, 0.09, 0.1, 0.26, m]);
      p.push([0, -0.02, 0.32, 0.1, 0.19, 0.07, s.wood ?? m]);
      break;
    case "skel":
      p.push([0, 0.05, 0.16, 0.05, 0.04, 0.3, m]);
      p.push([0, -0.09, 0.16, 0.05, 0.04, 0.3, m]);
      p.push([0, -0.02, 0.31, 0.08, 0.18, 0.06, BLACK]);
      break;
    case "fold":
      p.push([0, 0.02, 0.14, 0.14, 0.05, 0.24, m]);
      p.push([0, 0, 0.28, 0.1, 0.15, 0.06, BLACK]);
      break;
    case "sniper":
      p.push([0, -0.03, 0.18, 0.1, 0.16, 0.32, s.wood ?? m]);
      p.push([0, -0.12, 0.3, 0.09, 0.14, 0.12, s.wood ?? m]);
      p.push([0, 0.03, 0.36, 0.1, 0.12, 0.08, BLACK]);
      break;
  }

  // Optics
  if (activeScope === "red") {
    // Red Dot Sight
    p.push([0, h / 2 + 0.09, -bl * 0.45, 0.07, 0.09, 0.12, BLACK]);
    p.push([0, h / 2 + 0.11, -bl * 0.52, 0.05, 0.05, 0.02, 0xff3b3b]);
  } else if (activeScope === "holo") {
    // Holographic Sight
    p.push([0, h / 2 + 0.09, -bl * 0.45, 0.08, 0.09, 0.16, BLACK]);
    p.push([0, h / 2 + 0.09, -bl * 0.45, 0.06, 0.06, 0.14, 0x4dd2ff]);
  } else if (activeScope === "small") {
    // Medium scope (2x, 3x, 4x)
    p.push([0, h / 2 + 0.1, -bl * 0.45, 0.06, 0.06, 0.24, BLACK]);
    p.push([0, h / 2 + 0.1, -bl * 0.58, 0.05, 0.05, 0.02, 0x3df0a0]);
  } else if (activeScope === "big") {
    // High magnification scope (6x, 8x)
    p.push([0, h / 2 + 0.13, -bl * 0.5, 0.075, 0.075, 0.44, 0x101215]);
    p.push([0, h / 2 + 0.06, -bl * 0.36, 0.04, 0.06, 0.05, 0x2a2e33]);
    p.push([0, h / 2 + 0.06, -bl * 0.66, 0.04, 0.06, 0.05, 0x2a2e33]);
    p.push([0, h / 2 + 0.13, -bl * 0.5 - 0.23, 0.06, 0.06, 0.01, 0x7fe8ff]);
  }

  return p;
}
