// FightReady::getPosMyIndex table at ELF VA 0x82ab10.
// Our UI stores rows from left to right; the client stores front column first.
export const NATIVE_ALLY_SLOT_MAP = Object.freeze([6, 3, 0, 7, 4, 1, 8, 5, 2]);
export function nativeSlot(side, slot) {
  return side === "ally"
    ? NATIVE_ALLY_SLOT_MAP[slot]
    : (slot % 3) * 3 + Math.floor(slot / 3);
}
export const freshTurnCursor = () => ({ side: -1, position: 0 });

// Fighting::fightGo 0x2fd7c4–0x2fda0a. A new request switches sides at
// the current position. On a skipped candidate, check the other side once,
// then advance position without resetting side. This is a cursor, not a sort.
export function advanceNativeTurn(units, cursor, acted, firstSide = "ally") {
  const first = firstSide === "enemy" ? 1 : 0;
  if (cursor.side === -1) {
    cursor.side = first;
    cursor.position = 0;
  } else cursor.side = 1 - cursor.side;
  let checkedOther = false;
  while (cursor.position < 9) {
    const side = cursor.side === 0 ? "ally" : "enemy";
    const unit = units.find(
      (u) => u.side === side && nativeSlot(side, u.slot) === cursor.position,
    );
    if (unit?.hp > 0 && !acted.has(unit.id)) {
      acted.add(unit.id);
      return unit;
    }
    if (!checkedOther) {
      cursor.side = 1 - cursor.side;
      checkedOther = true;
    } else {
      cursor.position++;
      checkedOther = false;
    }
  }
  return null;
}
export function remainingNativeTurns(units, cursor, acted, firstSide = "ally") {
  const preview = { ...cursor },
    consumed = new Set(acted),
    ids = [];
  let unit;
  while ((unit = advanceNativeTurn(units, preview, consumed, firstSide)))
    ids.push(unit.id);
  return ids;
}
