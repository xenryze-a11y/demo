import { DEFAULT_FORMATION, HEROES, MAX_PARTY } from "./data.js?v=81cc37657afc";
import { normalizeHeroProgress } from "./progression.js?v=81cc37657afc";
const KEY = "sword-recreation-save-v1";
export const freshSave = () => ({
  version: 1,
  formation: [...DEFAULT_FORMATION],
  gold: 1118,
  crystals: 100,
  xp: 343,
  unlocked: 0,
  stars: {},
  sound: false,
  trainingCards: 6,
  heroProgress: Object.fromEntries(
    HEROES.map((h) => [h.id, { level: 6, xp: 178 }]),
  ),
});
export function normalizeSave(raw) {
  const clean = freshSave();
  if (!raw || raw.version !== 1) return clean;
  for (const key of ["gold", "crystals", "xp"])
    if (Number.isFinite(raw[key]) && raw[key] >= 0)
      clean[key] = Math.floor(raw[key]);
  clean.unlocked = Math.max(0, Math.min(2, Number(raw.unlocked) || 0));
  clean.sound = raw.sound === true;
  if (raw.trainingCards !== undefined)
    clean.trainingCards = Number.isFinite(raw.trainingCards)
      ? Math.max(0, Math.min(9999, Math.floor(raw.trainingCards)))
      : 0;
  for (const hero of HEROES)
    clean.heroProgress[hero.id] = normalizeHeroProgress(
      raw.heroProgress?.[hero.id],
      Math.min(30, levelFor(clean.xp)),
    );
  const used = new Set();
  if (Array.isArray(raw.formation) && raw.formation.length === 9) {
    clean.formation = raw.formation.map((id) => {
      if (
        !HEROES.some((h) => h.id === id) ||
        used.has(id) ||
        used.size >= MAX_PARTY
      )
        return null;
      used.add(id);
      return id;
    });
    if (!used.size) clean.formation = [...DEFAULT_FORMATION];
  }
  for (let i = 0; i < 4; i++)
    clean.stars[i] = Math.max(
      0,
      Math.min(3, Math.floor(Number(raw.stars?.[i]) || 0)),
    );
  return clean;
}
export function readSave() {
  try {
    return normalizeSave(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return freshSave();
  }
}
export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
export const levelFor = (xp) => 1 + Math.floor(xp / 62);
export function placeHero(formation, id, index) {
  if (
    !HEROES.some((h) => h.id === id) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 8
  )
    return { ok: false, reason: "请选择我方阵位" };
  const next = [...formation],
    source = next.indexOf(id);
  if (source === index) return { ok: true, formation: next };
  if (source < 0 && !next[index] && next.filter(Boolean).length >= MAX_PARTY)
    return { ok: false, reason: "最多上阵 5 人，请拖到已有英雄的阵位进行替换" };
  if (source >= 0) next[source] = next[index];
  next[index] = id;
  return { ok: true, formation: next };
}
export function removeHero(formation, id) {
  if (formation.filter(Boolean).length <= 1)
    return { ok: false, reason: "至少保留一位伙伴" };
  return { ok: true, formation: formation.map((x) => (x === id ? null : x)) };
}
