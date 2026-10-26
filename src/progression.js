import { isProtagonist } from "./data.js?v=669213efe941";
// Hero training is independent of account experience and has no DOM dependencies.
export const TRAINING_CARD_XP = 169;
export const HERO_LEVEL_CAP = 30;
export const heroXpRequired = (level) => 412 + (level - 6) * 62;
export function normalizeHeroProgress(raw, fallbackLevel = 6) {
  const level = Number.isFinite(raw?.level)
    ? Math.max(1, Math.min(HERO_LEVEL_CAP, Math.floor(raw.level)))
    : Math.max(1, Math.min(HERO_LEVEL_CAP, fallbackLevel));
  return {
    level,
    xp:
      level === HERO_LEVEL_CAP
        ? 0
        : Math.max(
            0,
            Math.min(
              heroXpRequired(level) - 1,
              Number.isFinite(raw?.xp) ? Math.floor(raw.xp) : 178,
            ),
          ),
  };
}
export function heroStats(hero, level) {
  const bonus = 1 + (level - 1) * 0.07;
  return {
    hp: Math.round(hero.hp * bonus),
    attack: Math.round(hero.attack * bonus),
    defense: hero.defense + Math.max(0, level - 6) * 2,
    speed: hero.speed,
  };
}
export function maxFeedCards(progress, available) {
  let needed = -progress.xp;
  for (let level = progress.level; level < HERO_LEVEL_CAP; level++)
    needed += heroXpRequired(level);
  return Math.max(0, Math.min(available, Math.ceil(needed / TRAINING_CARD_XP)));
}
export function feedHero(save, heroId, count) {
  if (isProtagonist(heroId))
    return { ok: false, reason: "主角等级随玩家成长，不吞噬英雄经验卡" };
  const progress = save.heroProgress?.[heroId];
  if (!progress) return { ok: false, reason: "请选择英雄" };
  if (progress.level >= HERO_LEVEL_CAP)
    return { ok: false, reason: "英雄已达到本版等级上限" };
  if (!Number.isInteger(count) || count < 1)
    return { ok: false, reason: "请输入大于零的整数数量" };
  if (count > save.trainingCards) return { ok: false, reason: "经验卡不足" };
  if (count > maxFeedCards(progress, save.trainingCards))
    return { ok: false, reason: "超过达到等级上限所需的数量" };
  const previous = { ...progress };
  let { level, xp } = progress;
  xp += count * TRAINING_CARD_XP;
  while (level < HERO_LEVEL_CAP && xp >= heroXpRequired(level)) {
    xp -= heroXpRequired(level);
    level++;
  }
  if (level === HERO_LEVEL_CAP) xp = 0;
  save.heroProgress[heroId] = { level, xp };
  save.trainingCards -= count;
  return {
    ok: true,
    previous,
    progress: { level, xp },
    gained: count * TRAINING_CARD_XP,
    count,
  };
}
