export interface ScoreRow { score: number; wave: number; kills: number; acc: number; best: string; date: number }
const KEY = "blockfront.scores.v1";

export function loadScores(): ScoreRow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ScoreRow[];
    return Array.isArray(arr) ? arr.slice(0, 10) : [];
  } catch { return []; }
}
export function saveScore(row: ScoreRow): { rows: ScoreRow[]; rank: number } {
  const rows = [...loadScores(), row].sort((a, b) => b.score - a.score).slice(0, 10);
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* ignore */ }
  return { rows, rank: rows.findIndex((r) => r === row) };
}
export function loadLoadout(): string[] {
  try {
    const raw = localStorage.getItem("blockfront.loadout");
    const a = raw ? JSON.parse(raw) : null;
    if (Array.isArray(a) && a.length === 2) return a;
  } catch { /* ignore */ }
  return ["m4a1s", "deagle"];
}
export function saveLoadout(l: string[]) {
  try { localStorage.setItem("blockfront.loadout", JSON.stringify(l)); } catch { /* ignore */ }
}
