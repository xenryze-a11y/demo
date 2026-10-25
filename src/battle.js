import { getHero, ENEMIES, SPELLS, STAGES } from "./data.js?v=81cc37657afc";
import { heroStats } from "./progression.js?v=81cc37657afc";
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
      heroLevel = heroProgress[id]?.level ?? level,
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
    if (u?.hp > 0) return u;
  }
  return null;
}
export function beginNextRound(b) {
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
  if (actor.kind === "boss" && b.round % 3 === 0) {
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
  const s = SPELLS.find((x) => x.id === id);
  if (!s) return { error: "未知技能" };
  if (b.outcome) return { error: "战斗已经结束" };
  if (b.energy < s.cost)
    return { error: "星能不足，普通攻击与新回合会恢复星能" };
  if (b.cooldowns[id] > 0)
    return { error: `技能还需 ${b.cooldowns[id]} 回合冷却` };
  let targets;
  if (s.target === "enemy") {
    const target = living(b, "enemy").find((x) => x.id === targetId);
    if (!target) return { error: "请选择一名存活的敌人" };
    targets = [target];
  } else targets = living(b, s.target === "allies" ? "ally" : "enemy");
  b.energy = Math.min(100, b.energy - s.cost + (s.gain || 0));
  b.cooldowns[id] = s.cooldown + 1;
  b.spellUsed = true;
  const power = Math.max(...living(b, "ally").map((u) => u.attack));
  return {
    kind: id,
    actor: living(b, "ally")[0]?.id,
    name: s.name,
    targets: targets.map((u) => ({
      id: u.id,
      amount:
        s.target === "allies"
          ? Math.round(u.maxHp * 0.3)
          : Math.round(power * (id === "comet" ? 2.2 : 1.8)),
      heal: s.target === "allies",
      critical: id === "comet",
    })),
  };
}
export function applyAction(b, action) {
  for (const hit of action.targets) {
    const unit = b.units.find((u) => u.id === hit.id);
    if (!unit || unit.hp <= 0) continue;
    unit.hp = Math.max(
      0,
      Math.min(unit.maxHp, unit.hp + (hit.heal ? hit.amount : -hit.amount)),
    );
  }
  b.actions++;
  if (["attack", "bolt", "heal"].includes(action.kind))
    b.energy = Math.min(100, b.energy + 5);
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
