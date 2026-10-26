import { HEROES, isProtagonist } from "./data.js?v=8fac583645eb";

// FightReady::switchChange uses a 400x490 panel. getHerosPosi centers
// are (976+110*column, 531-105*row) in the 1280x720 native design.
export const rosterPoint = (index) => ({
  x: (976 + 110 * (index % 3)) * 0.8,
  y: (720 - (531 - 105 * Math.floor(index / 3))) * 0.8,
});
export function createFormationRoster({
  root,
  state,
  save,
  portraits,
  select,
  bench,
  deploy,
  drag,
  release,
  manage,
  notify,
  signal,
}) {
  const panel = document.createElement("aside");
  panel.id = "formationRoster";
  panel.hidden = true;
  panel.setAttribute("aria-label", "更换英雄");
  root.querySelector("#game").append(panel);
  let gesture = null;
  const currentHeroes = () => [
    ...HEROES.filter(
      (h) => isProtagonist(h.id) && state.formation.includes(h.id),
    ),
    ...HEROES.filter((h) => !isProtagonist(h.id)),
  ];
  function render() {
    if (panel.hidden) return;
    const heroes = currentHeroes();
    panel.innerHTML = `<header><b>更换英雄</b><button data-roster-close aria-label="关闭英雄列表">×</button></header><div class="native-roster-grid">${Array.from(
      { length: 12 },
      (_, i) => {
        const h = heroes[i],
          p = rosterPoint(i);
        return h
          ? `<button class="native-roster-card ${state.formation.includes(h.id) ? "deployed" : ""} ${state.selected === h.id ? "selected" : ""}" data-roster-hero="${h.id}" style="left:${p.x - 720 - 40}px;top:${p.y - 92 - 42}px" aria-label="${h.name}，${state.formation.includes(h.id) ? "已上阵" : "候补"}"><img src="${portraits.get(h.id)}" alt="${h.name}"><span>${isProtagonist(h.id) ? state.level : save.heroProgress[h.id]?.level || 1}</span><i>${isProtagonist(h.id) ? "主角" : state.formation.includes(h.id) ? "已上阵" : "上阵"}</i></button>`
          : `<span class="native-roster-empty" style="left:${p.x - 720 - 40}px;top:${p.y - 92 - 42}px"></span>`;
      },
    ).join(
      "",
    )}</div><footer><button id="rosterManage">英雄详情</button><small>点击上下阵 · 拖动到箭头换位</small></footer>`;
  }
  panel.addEventListener(
    "pointerdown",
    (e) => {
      const card = e.target.closest("[data-roster-hero]");
      if (!card || e.button !== 0) return;
      e.preventDefault();
      gesture = {
        id: card.dataset.rosterHero,
        pointer: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        active: false,
      };
      panel.setPointerCapture(e.pointerId);
    },
    { signal },
  );
  panel.addEventListener(
    "pointermove",
    (e) => {
      if (!gesture || gesture.pointer !== e.pointerId) return;
      if (Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 5)
        gesture.active = true;
      if (gesture.active) drag(gesture.id, e);
    },
    { signal },
  );
  panel.addEventListener(
    "pointerup",
    (e) => {
      if (!gesture || gesture.pointer !== e.pointerId) return;
      const g = gesture;
      gesture = null;
      if (g.active) release(g.id, e);
      else if (isProtagonist(g.id)) select(g.id);
      else if (state.formation.includes(g.id)) bench(g.id);
      else {
        select(g.id);
        const empty = state.formation.indexOf(null);
        if (state.formation.filter(Boolean).length < 5 && empty >= 0)
          deploy(g.id, empty);
        else notify("选择一个阵位，或拖动英雄替换队员");
      }
      render();
    },
    { signal },
  );
  panel.addEventListener(
    "pointercancel",
    () => {
      gesture = null;
      release(null);
    },
    { signal },
  );
  panel.addEventListener(
    "click",
    (e) => {
      if (e.target.closest("[data-roster-close]")) close();
      if (e.target.closest("#rosterManage")) {
        close();
        manage();
      }
    },
    { signal },
  );
  function close() {
    panel.hidden = true;
    gesture = null;
  }
  return {
    render,
    close,
    open() {
      if (state.mode !== "formation") return;
      panel.hidden = false;
      render();
    },
    get isOpen() {
      return !panel.hidden;
    },
    destroy() {
      panel.remove();
    },
  };
}
