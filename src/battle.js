import { nativeUnitHit } from "./native-damage.js?v=9ed3ca2f5987";
import { getHero, ENEMIES, SPELLS, STAGES, HERO_SKILLS } from "./data.js?v=9ed3ca2f5987";
import { heroStats } from "./progression.js?v=9ed3ca2f5987";
import { APK_HERO_CONFIG } from "./apk-config.js?v=9ed3ca2f5987";
import {
  freshTurnCursor,
  advanceNativeTurn,
  remainingNativeTurns,
} from "./native-turns.js?v=9ed3ca2f5987";
import {
  attachNativeConfig,
  selectNativeSkill,
  resetNativeCooldown,
  selectNativeTargets,
} from "./native-combat.js?v=9ed3ca2f5987";
export function createBattle(
  formation,
  stageId = 0,
  level = 1,
  difficulty = 0,
  heroProgress = {},
) {
  const stage = STAGES[stageId];
  const allies = formation.flatMap((id, slot) => {
    if (!id) return [];
    const h = getHero(id),
      heroLevel =
        h.category === "protagonist"
          ? level
          : (heroProgress[id]?.level ?? level),
      stats = heroStats(h, heroLevel);
    return [
      {
        ...h,
        id,
        side: "ally",
        slot,
        ...stats,
        level: heroLevel,
        maxHp: stats.hp,
      },
    ];
  });
  const enemies = stage.enemies.map(([type, slot], i) => {
    const e = ENEMIES[type];
    return {
      ...e,
      id: `enemy-${i}`,
      side: "enemy",
      slot,
      maxHp: Math.round(e.hp * (difficulty ? 1.25 : 1)),
      hp: Math.round(e.hp * (difficulty ? 1.25 : 1)),
      attack: Math.round(e.attack * (difficulty ? 1.15 : 1)),
    };
  });
  return {
    units: [...allies, ...enemies],
    round: 1,
    energy: 60,
    queue: [],
    firstSide: "ally",
    turnCursor: null,
    actedThisRound: [],
    cooldowns: {},
    outcome: null,
    actions: 0,
    spellUsed: false,
    heroCooldowns: {},
    randomState: Math.floor(Math.random() * 0x100000000) >>> 0,
  };
}
export const living = (b, side) =>
  b.units.filter((u) => u.hp > 0 && (!side || u.side === side));
export function outcome(b) {
  if (!living(b, "enemy").length) return "victory";
  if (!living(b, "ally").length || b.round > 30) return "defeat";
  return null;
}
export function refillQueue(b) {
  b.turnCursor = freshTurnCursor();
  b.actedThisRound = [];
  b.queue = remainingNativeTurns(b.units, b.turnCursor, [], b.firstSide);
}
export function nextActor(b) {
  b.outcome = outcome(b);
  if (b.outcome) return null;
  if (b.turnCursor) {
    const acted = new Set(b.actedThisRound);
    let unit;
    while (
      (unit = advanceNativeTurn(b.units, b.turnCursor, acted, b.firstSide))
    ) {
      b.actedThisRound = [...acted];
      b.queue = remainingNativeTurns(b.units, b.turnCursor, acted, b.firstSide);
      unit.lastActedRound = b.round;
      if (unit.stun > 0) {
        unit.stun--;
        // The native controlled-turn branch also decrements positive skill CDs.
        if (b.heroCooldowns[unit.id] > 0) b.heroCooldowns[unit.id]--;
        completeActorTurn(unit);
        continue;
      }
      return unit;
    }
    b.actedThisRound = [...acted];
    b.queue = [];
    return null;
  }
  while (b.queue.length) {
    const id = b.queue.shift();
    const u = b.units.find((x) => x.id === id);
    if (u?.hp > 0) {
      if (u.stun > 0) {
        u.stun--;
        completeActorTurn(u);
        continue;
      }
      return u;
    }
  }
  return null;
}
const turnStatusKeys = [
  "silence",
  "shieldTurns",
  "reflectTurns",
  "blessingTurns",
];
function completeActorTurn(unit) {
  if (!unit) return;
  for (const key of turnStatusKeys) {
    if (unit.statusFresh?.[key]) unit.statusFresh[key] = false;
    else if (unit[key] > 0) unit[key]--;
  }
  if (!unit.shieldTurns) unit.shield = 0;
  if (!unit.reflectTurns) unit.reflect = 0;
  if (!unit.blessingTurns) unit.blessingBlock = 0;
}
function markTurnStatus(unit, key, action) {
  unit.statusFresh ||= {};
  unit.statusFresh[key] = action.actor === unit.id;
}
export function beginNextRound(b) {
  for (const unit of b.units) {
    if (unit.poison > 0 && unit.hp > 0) {
      unit.hp = Math.max(0, unit.hp - Math.round(unit.maxHp * 0.06));
      unit.poison--;
    }
  }
  b.round++;
  b.spellUsed = false;
  for (const key of Object.keys(b.cooldowns))
    b.cooldowns[key] = Math.max(0, b.cooldowns[key] - 1);
  b.energy = Math.min(100, b.energy + 14);
  refillQueue(b);
  b.outcome = outcome(b);
}
export function chooseTarget(b, actor) {
  const friends = living(b, actor.side),
    enemies = living(b, actor.side === "ally" ? "enemy" : "ally");
  if (actor.kind === "healer" && actor.basicBehavior !== "attack") {
    const hurt = friends
      .filter((u) => u.hp / u.maxHp < 0.85)
      .sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp);
    if (hurt.length) return hurt[0];
  }
  // Native basic range defaults to mode 1 when the server row is unavailable.
  // A provided runtime range can override this; character class is not a rule.
  return selectNativeTargets(enemies, actor.nativeBasicRange ?? 1, undefined, {
    row: Math.floor(actor.slot / 3),
  })[0];
}
export function basicAction(b, actor, random = () => battleRandom(b)) {
  if (actor.kind === "boss" && b.round % 3 === 0 && !actor.silence) {
    return {
      kind: "bossSlam",
      actor: actor.id,
      name: "裂空横扫",
      targets: living(b, "ally").map((unit) => ({
        id: unit.id,
        ...nativeUnitHit(actor, unit, 0.85, 0, "physical", random),
        heal: false,
      })),
    };
  }
  // Per-hero action cycle: skill, basic, basic, then skill again.
  // Controlled turns decrement positive cooldowns in nextActor too.
  const heroSkill = HERO_SKILLS[actor.heroSkillId || actor.id];
  if (heroSkill) {
    const active = {
      id: heroSkill.nativeId,
      coldNow: b.heroCooldowns[actor.id] || 0,
      coldInterval: heroSkill.cooldown,
      priority: 0,
      energyChange: 0,
    };
    const basic = {
      id: 0,
      coldNow: 0,
      coldInterval: 0,
      priority: 1,
      energyChange: 0,
    };
    const selected = selectNativeSkill([active, basic]);
    b.heroCooldowns[actor.id] = active.coldNow;
    if (selected === active && !actor.silence && !actor.stun)
      return heroSkillAction(b, actor.id);
  }
  const target = chooseTarget(b, actor);
  if (!target) return null;
  const heal = target.side === actor.side;
  const hit = nativeUnitHit(
    actor,
    target,
    1,
    0,
    ["healer", "mage"].includes(actor.kind) ? "magic" : "physical",
    random,
  );
  const amount = heal ? Math.round(actor.attack * 1.55) : hit.amount;
  const action = {
    kind: heal
      ? "heal"
      : ["ranger", "gunner", "mage", "healer", "shroom", "sentinel"].includes(
            actor.kind,
          )
        ? "bolt"
        : "attack",
    actor: actor.id,
    targets: [{ id: target.id, ...hit, amount, heal }],
    name: heal ? "萤光愈" : actor.skill || "突袭",
  };
  const hero = getHero(actor.heroSkillId || actor.id);
  const nativeHeroId = hero?.nativeId || actor.nativeId;
  const basicId =
    APK_HERO_CONFIG[nativeHeroId]?.basicSkill ||
    { 1001: 11000, 1002: 12000, 1003: 13000 }[nativeHeroId];
  return attachNativeConfig(action, basicId, nativeHeroId);
}
export function spellAction(b, id, targetId, random = () => battleRandom(b)) {
  const s = SPELLS.find((skill) => skill.id === id);
  if (!s) return { error: "未知技能" };
  const actor = living(b, "ally").find(
    (unit) => unit.category === "protagonist" && unit.classId === s.classId,
  );
  if (!actor) return { error: "对应主角未出战或已倒下" };
  if (actor.silence || actor.stun)
    return { error: "主角被控制，暂时无法释放技能" };
  if (b.outcome) return { error: "战斗已经结束" };
  if (b.energy < s.cost) return { error: "怒气不足" };
  if (b.cooldowns[id] > 0)
    return { error: `技能还需 ${b.cooldowns[id]} 回合冷却` };
  let targets;
  if (s.target === "enemy") {
    const target = living(b, "enemy").find((unit) => unit.id === targetId);
    if (!target) return { error: "请选择一名存活的敌人" };
    targets =
      s.pattern === "line"
        ? living(b, "enemy").filter((u) => u.slot % 3 === target.slot % 3)
        : s.pattern === "row"
          ? living(b, "enemy").filter(
              (u) => Math.floor(u.slot / 3) === Math.floor(target.slot / 3),
            )
          : [target];
  } else
    targets =
      s.target === "self"
        ? [actor]
        : living(b, s.target === "allies" ? "ally" : "enemy");
  b.energy = Math.min(100, b.energy - s.cost + (s.gain || 0));
  b.cooldowns[id] = s.cooldown + 1;
  const hits = s.hits || 1;
  return attachNativeConfig(
    {
      kind: s.id,
      actor: actor.id,
      name: s.name,
      animation: s.animation,
      leech: s.leech,
      targets: Array.from({ length: hits }, () =>
        targets.map((unit) => {
          const damage =
            s.shield || s.healing
              ? { amount: 0, critical: false, blocked: false }
              : nativeUnitHit(
                  actor,
                  unit,
                  s.ratio || 1,
                  s.flat || 0,
                  s.classId === "mage" ? "magic" : "physical",
                  random,
                );
          return {
            id: unit.id,
            amount: s.shield
              ? 0
              : s.healing
                ? Math.round(unit.maxHp * s.healing)
                : damage.amount,
            heal: !!s.healing,
            shield: s.shield ? Math.round(actor.maxHp * s.shield) : 0,
            status: s.status,
            turns: s.turns,
            purge: s.purge,
            critical: damage.critical,
            blocked: damage.blocked,
          };
        }),
      ).flat(),
      multi: hits > 1,
      hitGroups: Array(hits).fill(targets.length),
    },
    s.nativeId,
    actor.nativeId,
  );
}
function battleRandom(b) {
  // Store the PRNG state in the battle: playback and skip consume identical draws.
  b.randomState = (Math.imul(b.randomState, 1664525) + 1013904223) >>> 0;
  return b.randomState / 0x100000000;
}
export function heroSkillAction(b, id, random = () => battleRandom(b)) {
  const actor = living(b).find((u) => u.id === id),
    skillId = actor?.heroSkillId || id,
    skill = HERO_SKILLS[skillId];
  if (!actor || !skill) return { error: "英雄未出战或已倒下" };
  if (actor.silence || actor.stun)
    return { error: "英雄被控制，暂时无法释放技能" };
  if (b.heroCooldowns[id] > 0) return { error: "英雄技冷却中" };
  const enemies = living(b, actor.side === "ally" ? "enemy" : "ally"),
    target = enemies.slice().sort((a, c) => a.slot - c.slot)[0];
  if (!target) return { error: "没有可攻击的目标" };
  let targets = [];
  if (skillId === "sun")
    targets = [{ id, amount: 0, blessingBlock: 7500, turns: 2 }];
  if (skillId === "blade")
    targets = [{ id, amount: 0, reflect: 0.7, turns: 2 }];
  if (skillId === "pirate")
    targets = enemies
      .filter((u) => u.slot % 3 === target.slot % 3)
      .slice(0, 2)
      .map((u) => ({
        id: u.id,
        ...nativeUnitHit(actor, u, 1.35, 0, "physical", random),
      }));
  if (skillId === "rogue") {
    const pool = selectNativeTargets(enemies, 8, random);
    targets = Array.from({ length: 3 }, () =>
      pool.slice(0, 3).map((u) => ({
        id: u.id,
        ...nativeUnitHit(actor, u, 0.65, 0, "magic", random),
      })),
    ).flat();
  }
  if (skillId === "wind")
    targets = enemies
      .filter((u) => u.slot % 3 === target.slot % 3)
      .map((u) => ({
        id: u.id,
        ...nativeUnitHit(actor, u, 0.5, 0, "magic", random),
        status: "silence",
        turns: 1,
      }));
  const cooldown = { coldInterval: skill.cooldown, coldNow: 0 };
  resetNativeCooldown(cooldown);
  b.heroCooldowns[id] = cooldown.coldNow;
  return attachNativeConfig(
    {
      kind: skill.id,
      name: skill.name,
      actor: id,
      animation: skill.animation,
      targets,
      multi: skillId === "rogue",
      heroSkill: true,
      movement: skillId === "rogue" ? "advance-spin" : null,
      hitGroups:
        skillId === "rogue"
          ? Array(3).fill(targets.length / 3)
          : [targets.length],
    },
    skill.nativeId,
    getHero(skillId)?.nativeId,
  );
}
export function applyAction(
  b,
  action,
  start = 0,
  end = action.targets.length,
  finish = true,
) {
  const actor = b.units.find((u) => u.id === action.actor);
  for (const hit of action.targets.slice(start, end)) {
    const unit = b.units.find((u) => u.id === hit.id);
    if (!unit || unit.hp <= 0) continue;
    if (hit.shield) {
      unit.shield = hit.shield;
      unit.shieldTurns = hit.turns;
      markTurnStatus(unit, "shieldTurns", action);
      continue;
    }
    if (hit.reflect) {
      unit.reflect = hit.reflect;
      unit.reflectTurns = hit.turns;
      markTurnStatus(unit, "reflectTurns", action);
      continue;
    }
    if (hit.blessingBlock) {
      unit.blessingBlock = hit.blessingBlock;
      unit.blessingTurns = hit.turns;
      markTurnStatus(unit, "blessingTurns", action);
      continue;
    }
    let damage = Math.max(0, hit.amount || 0);
    if (!hit.heal) {
      const blocked = Math.min(unit.shield || 0, damage);
      unit.shield = (unit.shield || 0) - blocked;
      damage -= blocked;
    }
    const actual = Math.min(unit.hp, damage);
    unit.hp = Math.max(
      0,
      Math.min(unit.maxHp, unit.hp + (hit.heal ? damage : -damage)),
    );
    if (!hit.heal && unit.reflect && actor?.hp > 0)
      actor.hp = Math.max(0, actor.hp - Math.round(actual * unit.reflect));
    if (action.leech && actor?.hp > 0)
      actor.hp = Math.min(
        actor.maxHp,
        actor.hp + Math.round(actual * action.leech),
      );
    if (hit.status && unit.hp > 0) {
      unit[hit.status] = Math.max(unit[hit.status] || 0, hit.turns);
      if (hit.status === "silence") markTurnStatus(unit, hit.status, action);
    }
    if (hit.purge) {
      unit.shield = 0;
      unit.reflect = 0;
      unit.blessingBlock = 0;
      unit.blessingTurns = 0;
    }
  }
  if (finish) {
    b.actions++;
    completeActorTurn(actor);
    if (
      actor?.side === "ally" &&
      ["attack", "bolt", "heal"].includes(action.kind)
    )
      b.energy = Math.min(100, b.energy + 5);
  }
  b.outcome = outcome(b);
  return b.outcome;
}
export function starsFor(b) {
  const alive = living(b, "ally").length,
    total = b.units.filter((u) => u.side === "ally").length;
  return alive === total && b.round <= 8
    ? 3
    : alive >= Math.ceil(total / 2)
      ? 2
      : 1;
}
