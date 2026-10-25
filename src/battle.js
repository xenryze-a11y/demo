import { getHero, ENEMIES, SPELLS, STAGES, HERO_SKILLS } from "./data.js?v=e7b6ee51ab02";
import { heroStats } from "./progression.js?v=e7b6ee51ab02";
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
    cooldowns: {},
    outcome: null,
    actions: 0,
    spellUsed: false,
    heroCooldowns: {},
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
  b.queue = living(b)
    .sort((a, c) => c.speed - a.speed)
    .map((u) => u.id);
}
export function nextActor(b) {
  b.outcome = outcome(b);
  if (b.outcome) return null;
  while (b.queue.length) {
    const id = b.queue.shift();
    const u = b.units.find((x) => x.id === id);
    if (u?.hp > 0) {
      if (u.stun > 0) {
        u.stun--;
        continue;
      }
      return u;
    }
  }
  return null;
}
export function beginNextRound(b) {
  for (const unit of b.units) {
    if (unit.poison > 0 && unit.hp > 0) {
      unit.hp = Math.max(0, unit.hp - Math.round(unit.maxHp * 0.06));
      unit.poison--;
    }
    for (const key of ["silence", "shieldTurns", "reflectTurns"])
      if (unit[key] > 0) unit[key]--;
    if (!unit.shieldTurns) unit.shield = 0;
    if (!unit.reflectTurns) unit.reflect = 0;
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
  if (actor.kind === "healer") {
    const hurt = friends
      .filter((u) => u.hp / u.maxHp < 0.85)
      .sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp);
    if (hurt.length) return hurt[0];
  }
  if (actor.kind === "ranger") return enemies.sort((a, c) => a.hp - c.hp)[0];
  if (actor.kind === "rogue")
    return enemies.sort((a, c) => (c.slot % 3) - (a.slot % 3))[0];
  // Front column protects each row; empty rows fall back to the nearest front unit.
  const row = Math.floor(actor.slot / 3);
  return enemies.sort((a, c) => {
    const score = (u) =>
      Math.abs(Math.floor(u.slot / 3) - row) * 2 +
      (u.side === "ally" ? 2 - (u.slot % 3) : u.slot % 3);
    return score(a) - score(c);
  })[0];
}
export function basicAction(b, actor, random = Math.random) {
  if (actor.kind === "boss" && b.round % 3 === 0 && !actor.silence) {
    return {
      kind: "bossSlam",
      actor: actor.id,
      name: "裂空横扫",
      targets: living(b, "ally").map((unit) => ({
        id: unit.id,
        amount: Math.max(
          12,
          Math.round(actor.attack * 0.85 - unit.defense * 0.4),
        ),
        heal: false,
        critical: false,
      })),
    };
  }
  // Per-hero action cycle: skill, basic, basic, then skill again.
  // A stunned/skipped action never advances this counter; rounds alone do not reset it.
  if (HERO_SKILLS[actor.heroSkillId || actor.id]) {
    if (!(b.heroCooldowns[actor.id] > 0) && !actor.silence && !actor.stun)
      return heroSkillAction(b, actor.id);
    if (b.heroCooldowns[actor.id] > 0) b.heroCooldowns[actor.id]--;
  }
  const target = chooseTarget(b, actor);
  if (!target) return null;
  const heal = target.side === actor.side,
    critical = !heal && random() < 0.12;
  const rear = target.side === "ally" && target.slot % 3 === 0 ? 0.86 : 1;
  const amount = heal
    ? Math.round(actor.attack * 1.55)
    : Math.max(
        12,
        Math.round(
          (actor.attack - target.defense * 0.55) *
            rear *
            (0.94 + random() * 0.12) *
            (critical ? 1.6 : 1),
        ),
      );
  return {
    kind: heal
      ? "heal"
      : ["ranger", "gunner", "mage", "healer", "shroom", "sentinel"].includes(
            actor.kind,
          )
        ? "bolt"
        : "attack",
    actor: actor.id,
    targets: [{ id: target.id, amount, heal, critical }],
    name: heal ? "萤光愈" : actor.skill || "突袭",
  };
}
export function spellAction(b, id, targetId) {
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
  return {
    kind: s.id,
    actor: actor.id,
    name: s.name,
    animation: s.animation,
    leech: s.leech,
    targets: Array.from({ length: hits }, () =>
      targets.map((unit) => ({
        id: unit.id,
        amount: s.shield
          ? 0
          : s.healing
            ? Math.round(unit.maxHp * s.healing)
            : Math.round(actor.attack * (s.ratio || 1) + (s.flat || 0)),
        heal: !!s.healing,
        shield: s.shield ? Math.round(actor.maxHp * s.shield) : 0,
        status: s.status,
        turns: s.turns,
        purge: s.purge,
        critical: false,
      })),
    ).flat(),
    multi: hits > 1,
  };
}
export function heroSkillAction(b, id) {
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
    targets = [
      { id, amount: 0, shield: Math.round(actor.maxHp * 0.35), turns: 2 },
    ];
  if (skillId === "blade")
    targets = [{ id, amount: 0, reflect: 0.7, turns: 2 }];
  if (skillId === "pirate")
    targets = enemies
      .filter((u) => u.slot % 3 === target.slot % 3)
      .slice(0, 2)
      .map((u) => ({ id: u.id, amount: Math.round(actor.attack * 1.35) }));
  if (skillId === "rogue")
    targets = Array.from({ length: 3 }, () =>
      enemies
        .slice(0, 3)
        .map((u) => ({ id: u.id, amount: Math.round(actor.attack * 0.65) })),
    ).flat();
  if (skillId === "wind")
    targets = enemies
      .filter((u) => u.slot % 3 === target.slot % 3)
      .map((u) => ({
        id: u.id,
        amount: Math.round(actor.attack * 0.5),
        status: "silence",
        turns: 2,
      }));
  b.heroCooldowns[id] = 2;
  return {
    kind: skill.id,
    name: skill.name,
    actor: id,
    animation: skill.animation,
    targets,
    multi: skillId === "rogue",
    heroSkill: true,
    movement: skillId === "rogue" ? "advance-spin" : null,
  };
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
      continue;
    }
    if (hit.reflect) {
      unit.reflect = hit.reflect;
      unit.reflectTurns = hit.turns;
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
    if (hit.status && unit.hp > 0)
      unit[hit.status] = Math.max(unit[hit.status] || 0, hit.turns);
    if (hit.purge) {
      unit.shield = 0;
      unit.reflect = 0;
    }
  }
  if (finish) {
    b.actions++;
    if (["attack", "bolt", "heal"].includes(action.kind))
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
