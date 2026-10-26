import { equippedSpells } from "./data.js?v=9ed3ca2f5987";
import { living, basicAction, spellAction, heroSkillAction } from "./battle.js?v=9ed3ca2f5987";

// DOM-free decisions shared by visible playback, skip, and replay tests.
// This selects one action for an already scheduled actor; it never advances
// the native cursor or grants a second action to a queued command.
export function resolveActorCommand(
  battle,
  actor,
  { pending = null, auto = false, skillLoadouts = {} } = {},
) {
  let notice = null;
  if (!actor || actor.hp <= 0 || battle.outcome)
    return { action: null, pending, notice };

  const manualHero = pending?.id.startsWith("hero:");
  const controlsActor =
    pending &&
    actor.side === "ally" &&
    (manualHero
      ? pending.id.slice(5) === actor.id
      : actor.category === "protagonist");
  const cooling = manualHero
    ? battle.heroCooldowns[actor.id]
    : battle.cooldowns[pending?.id];
  if (controlsActor && !actor.silence && !actor.stun && !cooling) {
    const enemies = living(battle, "enemy");
    const target =
      enemies.find((unit) => unit.id === pending.target) ||
      enemies.sort((a, b) => (a.slot % 3) - (b.slot % 3) || a.slot - b.slot)[0];
    const action = manualHero
      ? heroSkillAction(battle, actor.id)
      : spellAction(battle, pending.id, target?.id);
    if (!action.error) return { action, pending: null, notice };
    notice = action.error;
  }

  if (
    auto &&
    actor.side === "ally" &&
    actor.category === "protagonist" &&
    !actor.silence &&
    !actor.stun
  ) {
    const skills = equippedSpells(battle, skillLoadouts).filter(
      (skill) => !battle.cooldowns[skill.id] && battle.energy >= skill.cost,
    );
    const healing = skills.find(
      (skill) =>
        skill.healing &&
        living(battle, "ally").some((unit) => unit.hp / unit.maxHp < 0.6),
    );
    const selected =
      healing ||
      skills.find((skill) => skill.cost === 50) ||
      skills.find((skill) => skill.gain);
    if (selected) {
      const action = spellAction(
        battle,
        selected.id,
        living(battle, "enemy")[0]?.id,
      );
      if (!action.error) return { action, pending, notice };
    }
  }
  return { action: basicAction(battle, actor), pending, notice };
}
