// Common byAttack branch, ELF 0x2f7468–0x2f7c8a. Runtime stats and
// special effect modifiers remain inputs, not claimed recovered server data.
const f32 = Math.fround;
export function nativeChance(basisPoints, random) {
  return basisPoints > 0 && Math.floor(random() * 10000) < basisPoints;
}
export function nativeDamage(
  {
    attack,
    defense = 0,
    coefficient = 10000,
    flat = 0,
    criticalRate = 0,
    criticalResistance = 0,
    criticalBonus = 0,
    blockRate = 0,
    blockPenetration = 0,
    damageRate = 10000,
    damageReduction = 0,
    ignoreDefense = false,
    immune = false,
  },
  random = Math.random,
) {
  const scaled = f32((f32(attack) * coefficient) / 10000);
  let amount = Math.max(
    1,
    f32(scaled - (ignoreDefense ? 0 : Math.max(0, defense))),
  );
  const critical = nativeChance(
    criticalRate + criticalBonus - criticalResistance,
    random,
  );
  if (critical) amount = f32(amount * 2);
  amount = f32(amount + Math.max(0, flat));
  amount = f32((amount * (damageRate - damageReduction)) / 10000);
  const blocked = nativeChance(blockRate - blockPenetration, random);
  if (blocked) amount = f32(amount * 0.5);
  amount = f32(amount + amount * (-0.01 + random() * 0.02));
  amount = immune ? 0 : Math.max(1, amount);
  return { amount: Math.trunc(amount), critical, blocked };
}
export function nativeUnitHit(
  actor,
  target,
  ratio,
  flat = 0,
  type = "physical",
  random = Math.random,
) {
  return nativeDamage(
    {
      attack:
        type === "magic" ? (actor.magicAttack ?? actor.attack) : actor.attack,
      defense:
        type === "magic"
          ? (target.magicDefense ?? target.defense)
          : target.defense,
      coefficient: Math.round(ratio * 10000),
      flat,
      criticalRate: actor.criticalRate ?? 0,
      criticalResistance: target.criticalResistance ?? 0,
      blockRate: (target.blockRate ?? 0) + (target.blessingBlock ?? 0),
      blockPenetration: actor.blockPenetration ?? 0,
      damageRate: actor.damageRate ?? 10000,
      damageReduction: target.damageReduction ?? 0,
    },
    random,
  );
}
