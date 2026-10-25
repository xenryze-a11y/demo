import { HEROES, getHero, isProtagonist } from "./data.js?v=4f68d6b04255";
import {
  TRAINING_CARD_XP,
  HERO_LEVEL_CAP,
  heroXpRequired,
  heroStats,
  maxFeedCards,
  feedHero,
} from "./progression.js?v=4f68d6b04255";

function trainingCardIcon() {
  return `<svg viewBox="0 0 70 78" aria-hidden="true"><defs><linearGradient id="cardGreen" x2="0" y2="1"><stop stop-color="#6a9867"/><stop offset="1" stop-color="#132b20"/></linearGradient></defs><g stroke="#bac8ad" stroke-width="2"><rect x="8" y="10" width="45" height="58" rx="4" fill="#293e2c" transform="rotate(-12 30 38)"/><rect x="16" y="8" width="45" height="58" rx="4" fill="url(#cardGreen)" transform="rotate(9 38 37)"/><path d="M25 17L50 19 55 30 51 55 27 57 20 42Z" fill="none"/><path d="M20 32L37 16 55 34H44V51H31V33Z" fill="#91ff30" stroke="#d6ff9c"/></g><text x="35" y="74" text-anchor="middle" fill="#ffff7b" font-size="13">★★</text></svg>`;
}

export function createTraining({
  root,
  save,
  portraits,
  art,
  showModal,
  frame,
  persist,
  onFormation,
  play,
}) {
  const $ = (selector) => root.querySelector(selector);
  let selected = "pirate";
  const source = (id) => art["card" + getHero(id).sprite].src;
  function open(id = selected, feedback = null) {
    selected = getHero(id) && !isProtagonist(id) ? id : "pirate";
    const hero = getHero(selected),
      progress = save.heroProgress[selected];
    const stats = heroStats(hero, progress.level),
      required = heroXpRequired(progress.level);
    const capped = progress.level >= HERO_LEVEL_CAP;
    const power = Math.round(
      stats.hp * 0.3 + stats.attack * 4 + stats.defense * 3,
    );
    const before = feedback ? heroStats(hero, feedback.previous.level) : stats;
    const increased = feedback && progress.level > feedback.previous.level;
    showModal(
      "training",
      frame(
        "英雄强化",
        `
      <nav class="training-tabs" aria-label="英雄管理">
        <button class="training-tab" id="trainingFormation">英雄布阵</button>
        <button class="training-tab selected" aria-current="page">英雄强化</button>
        <span class="training-tab unavailable">英雄突破<small>未开放</small></span>
        <span class="training-tab unavailable">英雄升星<small>未开放</small></span>
        <span class="training-tab unavailable">英雄合成<small>未开放</small></span>
      </nav>
      <div class="training-layout">
        <section class="training-hero">
          <div class="training-platform"></div>
          <div class="large-hero-card ${feedback ? "empowered" : ""}">
            <div class="card-sparkles"></div><span class="card-stars">★★★★</span><span class="card-rank">A</span>
            <img class="training-art ${selected === "pirate" ? "pirate-art" : ""}" src="${source(selected)}" alt="${hero.name}">
            <div class="training-card-bottom"><strong style="color:${hero.color}">${hero.name}</strong><div class="training-level"><b>Lv ${progress.level}</b><div class="hero-xp"><i style="width:${capped ? 100 : (progress.xp / required) * 100}%"></i><span>${capped ? "MAX" : `${progress.xp}/${required}`}</span></div></div></div>
            ${feedback ? `<div class="training-burst" aria-hidden="true"></div>` : ""}
          </div>
          <button class="ornate blue choose-training-hero" id="chooseTrainingHero">选择英雄</button>
          <dl class="training-stats"><div><dt>战力</dt><dd class="power">${power}</dd></div><div><dt>生命</dt><dd>${stats.hp}${increased ? `<em> ↑${stats.hp - before.hp}</em>` : ""}</dd></div><div><dt>物攻</dt><dd>${stats.attack}${increased ? `<em> ↑${stats.attack - before.attack}</em>` : ""}</dd></div><div><dt>物防</dt><dd>${stats.defense}${increased ? `<em> ↑${stats.defense - before.defense}</em>` : ""}</dd></div><div><dt>速度</dt><dd>${stats.speed}</dd></div><div><dt>定位</dt><dd>${hero.role}</dd></div></dl>
        </section>
        <section class="training-materials" aria-label="强化材料">
          <div class="material-grid">${Array.from({ length: 25 }, (_, i) => (i === 0 && save.trainingCards > 0 ? `<button id="experienceCard" class="material-slot occupied" aria-label="二星经验卡，剩余${save.trainingCards}张" ${capped ? "disabled" : ""}>${trainingCardIcon()}<b>×${save.trainingCards}</b></button>` : '<span class="material-slot" aria-hidden="true"></span>')).join("")}</div>
          <p class="training-tip">${capped ? "英雄已达本版 Lv.30 上限" : save.trainingCards ? "点击经验卡，选择吞噬数量" : "经验卡已用完 · 通关战斗可获得"}</p>
          <div class="material-page"><span>◀</span> 1 / 1 <span>▶</span></div>
        </section>
      </div>
      ${feedback ? `<div class="training-feedback" role="status">${increased ? `升级成功！Lv.${feedback.previous.level} → Lv.${progress.level}` : `已吞噬成功 ${feedback.count} 张二星经验卡`}<small>英雄经验 +${feedback.gained}${increased ? " · 属性已提升" : ""}</small></div>` : ""}
    `,
        "training-window",
      ),
    );
    $("#trainingFormation").onclick = onFormation;
    $("#chooseTrainingHero").onclick = picker;
    if ($("#experienceCard")) $("#experienceCard").onclick = confirmFeed;
  }
  function picker() {
    showModal(
      "training-picker",
      frame(
        "选择强化英雄",
        `
      <div class="training-roster">${Array.from({ length: 16 }, (_, i) => {
        const h = HEROES.filter((h) => !isProtagonist(h.id))[i];
        return h
          ? `<button class="training-roster-card ${h.id === selected ? "selected" : ""}" data-train-hero="${h.id}"><img src="${portraits.get(h.id)}" alt=""><strong style="color:${h.color}">${h.name}</strong><small>Lv:${save.heroProgress[h.id].level}</small><span>★★★★</span><b>A</b></button>`
          : '<span class="training-roster-card empty"></span>';
      }).join(
        "",
      )}</div><div class="training-roster-footer"><button class="ornate blue" id="trainingPickerBack">返回强化</button><span>◀　1 / 1　▶</span></div>
    `,
        "training-picker-window",
      ),
    );
    root
      .querySelectorAll("[data-train-hero]")
      .forEach(
        (button) => (button.onclick = () => open(button.dataset.trainHero)),
      );
    $("#trainingPickerBack").onclick = () => open();
  }
  function confirmFeed() {
    if ($(".consume-shade")) return;
    const max = maxFeedCards(save.heroProgress[selected], save.trainingCards);
    if (!max) return;
    const shade = document.createElement("div");
    shade.className = "consume-shade";
    shade.innerHTML = `<form class="consume-window" aria-label="确认吞噬经验卡"><button type="button" class="close" id="cancelFeed" aria-label="取消吞噬">×</button><h3>二星经验卡</h3><div class="consume-description"><div class="material-slot occupied">${trainingCardIcon()}</div><p>说明：给选中的英雄使用，<br>每张可获得 <b>${TRAINING_CARD_XP}</b> 点经验。</p></div><label>剩　　余：<b>${save.trainingCards} 张</b></label><label for="feedCount">吞噬数量：<input id="feedCount" type="number" inputmode="numeric" min="1" max="${max}" step="1" value="1" required></label><label>吞噬经验：<output id="feedXp">${TRAINING_CARD_XP}</output></label><p id="feedError" role="status"></p><button class="ornate blue" id="submitFeed" type="submit">提交</button></form>`;
    $(".training-window").append(shade);
    const cancel = () => {
      shade.remove();
      $("#experienceCard")?.focus();
    };
    $("#cancelFeed").onclick = cancel;
    $("#feedCount").oninput = () => {
      const count = $("#feedCount").valueAsNumber;
      $("#feedXp").textContent =
        Number.isInteger(count) && count > 0 && count <= max
          ? count * TRAINING_CARD_XP
          : "—";
      $("#feedError").textContent = "";
    };
    let submitted = false;
    shade.querySelector("form").onsubmit = (event) => {
      event.preventDefault();
      if (submitted) return;
      const result = feedHero(save, selected, $("#feedCount").valueAsNumber);
      if (!result.ok) {
        $("#feedError").textContent = result.reason;
        return;
      }
      submitted = true;
      persist();
      play("win");
      open(selected, result);
    };
    $("#submitFeed").focus();
  }
  return { open, picker };
}
