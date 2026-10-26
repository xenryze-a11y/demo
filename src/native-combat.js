import { APK_SKILL_CONFIG } from './apk-config.js?v=669213efe941';

// getRangeHero jump table @ 0x2f2358: range 5 selects the lowest HP ratio;
// ranges 6..13 select (range - 5) distinct living targets after random ordering.
// Callers supply the side-filtered pool; unsupported modes stay explicit.
export function selectNativeTargets(pool, range, random = Math.random) {
  const alive = pool.filter((unit) => unit.hp > 0).slice().sort((a, b) => a.slot - b.slot);
  if (range === 5) {
    const selected = alive.reduce((best, unit) =>
      !best || unit.hp / unit.maxHp < best.hp / best.maxHp ? unit : best, null);
    return selected ? [selected] : [];
  }
  if (range >= 6 && range <= 13 && Number.isInteger(range)) {
    for (let i = alive.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [alive[i], alive[j]] = [alive[j], alive[i]];
    }
    return alive.slice(0, range - 5);
  }
  throw new RangeError('Native target mode has not been recovered: ' + range);
}

// FightSkillInfo::parse @ 0x2ac65c, cross-checked against the named getters.
// Values are supplied at runtime. Never manufacture a "recovered" server row.
export function decodeNativeSkill(row) {
  if (!Array.isArray(row) || row.length < 11 ||
      !row.slice(0, 10).every(Number.isFinite) || !Array.isArray(row[10]))
    throw new TypeError('Invalid FightSkillInfo row');
  const [id, damageCoefficientRaw, damageType, usedByOther, range, priority,
    coldNow, coldInterval, hitLevelRaw, energyChange, effects] = row;
  return { id, damageCoefficientRaw, damageType, usedByOther, range, priority,
    coldNow, coldInterval, hitLevelRaw, energyChange, effects: structuredClone(effects) };
}

// Ordinary, uncontrolled turn path in Fighting::fightGoAct (0x2fbef2–0x2fbf44).
// Lower numeric priority wins; ties keep the first entry. A positive cooldown
// decrements this turn but does not become eligible until the next actor turn.
export function selectNativeSkill(skills, { offset = 0, energy = Infinity } = {}) {
  let selected = null;
  for (const skill of skills) {
    if (skill.coldNow - offset > 0) {
      skill.coldNow--;
      continue;
    }
    if (energy < -skill.energyChange) continue;
    if (!selected || skill.priority < selected.priority) selected = skill;
  }
  return selected;
}
export function resetNativeCooldown(skill, offset = 0) {
  if (skill.coldInterval > 0) skill.coldNow = offset + skill.coldInterval;
}

export function nativeSkillConfig(id, heroId) {
  const candidates = APK_SKILL_CONFIG[id];
  // Native getData_ByList prefers a hero-specific entry, then the generic one.
  return candidates?.find((s) => s.heroId === heroId) ||
    candidates?.find((s) => s.heroId === null || s.heroId === 0) || null;
}

export function attachNativeConfig(action, id, heroId) {
  const config = nativeSkillConfig(id, heroId);
  return { ...action, nativeId: id, nativeConfig: config,
    animation: config?.animation || action.animation };
}

// Pure timeline shared by playback, hit accounting and tests. Input groups
// retain simultaneous victims; intervals are seconds from the APK table.
export function nativeTimeline(action, { animationMs = 900, travelMs = 0 } = {}) {
  const config = action.nativeConfig;
  const fallback = action.kind === 'attack' ? 200 : 500;
  const first = travelMs + (config?.hitDelay == null ? fallback : config.hitDelay * 1000);
  const interval = (config?.hitInterval ?? 0) * 1000;
  const groups = action.hitGroups || [action.targets.length];
  let end = 0;
  const events = groups.map((count, index) => ({
    at: first + index * interval, end: (end += count),
  }));
  const last = events.at(-1)?.at ?? first;
  const castEnd = Math.max(last + 200, travelMs + animationMs);
  return { events, castStart: travelMs, castEnd,
    duration: castEnd + travelMs + 120 };
}
export function dueNativeHits(timeline, elapsed) {
  let count = 0;
  for (const event of timeline.events) {
    if (elapsed < event.at) break;
    count = event.end;
  }
  return count;
}
