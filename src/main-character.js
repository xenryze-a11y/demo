import {
  MAIN_CLASSES,
  HEROES,
  SPELLS,
  isProtagonist,
  getHero,
  skillLoadout,
} from "./data.js?v=e7b6ee51ab02";
import { levelFor } from "./state.js?v=e7b6ee51ab02";
import { iconSvg } from "./art.js?v=e7b6ee51ab02";
export function createMainPanel({
  root,
  save,
  state,
  art,
  showModal,
  frame,
  onChange,
}) {
  let selectedSlot = 0;
  function open() {
    const current = state.formation.find(isProtagonist) || "ranger";
    const equipped = skillLoadout(current, save.skillLoadouts[current]);
    showModal(
      "main-character",
      frame(
        "主角 · 职业与技能",
        `<div class="main-classes">${MAIN_CLASSES.map((id) => {
          const h = getHero(id);
          return `<button data-main-class="${id}" class="main-class ${id === current ? "selected" : ""}" aria-pressed="${id === current}"><img src="${art["head" + h.sprite].src}" alt="${h.name}"><b>${h.name}</b><small>${id === current ? "当前主角" : "切换职业"}</small></button>`;
        }).join(
          "",
        )}<p>三主角选择其一出战<br>主角等级 Lv.${levelFor(save.xp)} · 随玩家成长<br>队伍由一名主角和最多四名英雄组成</p></div><div class="equipped-skills"><span>出战技能：先选槽位，再点下方技能替换</span>${equipped.map((id, i) => `<button data-skill-slot="${i}" class="${selectedSlot === i ? "selected" : ""}">${i + 1} · ${SPELLS.find((s) => s.id === id).name}</button>`).join("")}</div><div class="main-skill-library">${SPELLS.filter(
          (s) => s.classId === current,
        )
          .map(
            (s) =>
              `<article><button data-equip-skill="${s.id}" title="装备${s.name}" aria-label="装备${s.name}">${iconSvg(s.nativeId)}</button><div><b>${s.name}</b><small>${s.description}</small><em>${s.gain ? "怒气 +" + s.gain : "怒气 −" + s.cost} · 冷却 ${s.cooldown} 回合</em></div></article>`,
          )
          .join("")}</div>`,
        "main-window",
      ),
    );
    root.querySelectorAll("[data-main-class]").forEach(
      (button) =>
        (button.onclick = () => {
          const id = button.dataset.mainClass;
          if (id === current) return;
          const index = state.formation.findIndex(isProtagonist);
          state.formation[index >= 0 ? index : 5] = id;
          state.selected = id;
          onChange();
          open();
        }),
    );
    root.querySelectorAll("[data-skill-slot]").forEach(
      (button) =>
        (button.onclick = () => {
          selectedSlot = Number(button.dataset.skillSlot);
          open();
        }),
    );
    root.querySelectorAll("[data-equip-skill]").forEach(
      (button) =>
        (button.onclick = () => {
          const id = button.dataset.equipSkill,
            existing = equipped.indexOf(id);
          if (existing >= 0) equipped[existing] = equipped[selectedSlot];
          equipped[selectedSlot] = id;
          save.skillLoadouts[current] = equipped;
          onChange();
          open();
        }),
    );
  }
  return { open };
}
