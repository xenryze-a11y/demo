import { createFormationRoster } from "./formation-roster.js?v=8fac583645eb";
import {
  HEROES,
  STAGES,
  SPELLS,
  DEFAULT_FORMATION,
  getHero,
  isProtagonist,
  HERO_SKILLS,
  equippedSpells,
} from "./data.js?v=8fac583645eb";
import {
  readSave,
  writeSave,
  levelFor,
  placeHero,
  removeHero,
} from "./state.js?v=8fac583645eb";
import {
  createBattle,
  living,
  refillQueue,
  nextActor,
  beginNextRound,
  basicAction,
  spellAction,
  heroSkillAction,
  applyAction,
} from "./battle.js?v=8fac583645eb";
import { ART, loadArt, portrait, chestImage, iconSvg } from "./art.js?v=8fac583645eb";
import { Battlefield, prepareActionTimeline } from "./renderer.js?v=8fac583645eb";
import { dueNativeHits } from "./native-combat.js?v=8fac583645eb";
import { Sound } from "./audio.js?v=8fac583645eb";
import { createMainPanel } from "./main-character.js?v=8fac583645eb";
import { createTraining } from "./training.js?v=8fac583645eb";

export async function mountGame(root = document) {
  const $ = (q) => root.querySelector(q),
    save = readSave(),
    sound = new Sound(save.sound),
    controller = new AbortController();
  const listen = (el, type, callback, options = {}) =>
    el.addEventListener(type, callback, {
      ...options,
      signal: controller.signal,
    });
  const field = $("#field"),
    view = new Battlefield(field);
  const state = {
    mode: "formation",
    stage: 0,
    difficulty: 0,
    formation: [...save.formation],
    selected: "blade",
    battle: null,
    anim: null,
    drag: null,
    targeting: null,
    pending: null,
    paused: false,
    auto: false,
    speed: 1,
    level: levelFor(save.xp),
    heroProgress: save.heroProgress,
    wait: 0,
    loading: 0,
    countdown: 0,
  };
  let result = null,
    frameId = 0,
    last = performance.now(),
    toastTimer,
    bannerTimer,
    disposed = false,
    activeModal = null,
    previousFocus = null;
  const portraits = new Map();
  let closedChest, openChest;
  function resize() {
    $("#game").style.setProperty(
      "--game-scale",
      Math.min(innerWidth / 1024, innerHeight / 576),
    );
  }
  resize();
  listen(window, "resize", resize);
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await $("#viewport").requestFullscreen();
    } catch {
      toast("当前浏览器不支持全屏，可横屏游玩");
    }
  }
  $("#more").onclick = () => {
    $("#extrasMenu").hidden = !$("#extrasMenu").hidden;
    $("#more").setAttribute("aria-expanded", String(!$("#extrasMenu").hidden));
  };
  listen($("#extrasMenu"), "click", (e) => {
    if (e.target.closest("button")) {
      $("#extrasMenu").hidden = true;
      $("#more").setAttribute("aria-expanded", "false");
    }
  });
  $("#fullscreen").onclick = fullscreen;
  $("#mobileFull").onclick = fullscreen;
  try {
    await loadArt((completed, total) => {
      if (!$("#retryLoad").hidden) return;
      $("#loading small").textContent =
        `正在加载场景与英雄… ${completed}/${total}`;
      $("#loading i").style.width = `${(completed / total) * 100}%`;
    });
  } catch (error) {
    $("#loading small").textContent = "加载未完成，请检查网络后重试";
    $("#retryLoad").hidden = false;
    $("#retryLoad").onclick = () => location.reload();
    return {
      destroy() {
        controller.abort();
      },
    };
  }
  if (disposed) return;
  $("#game").style.setProperty("--map-image", `url("${ART.map.src}")`);
  $("#game").style.setProperty("--native-blue", `url("${ART.buttonBlue.src}")`);
  $("#game").style.setProperty("--native-gold", `url("${ART.buttonGold.src}")`);
  for (const key of [
    "orbRedFrame",
    "orbBlueFrame",
    "orbRedFill",
    "orbBlueFill",
    "skillFrame",
    "skillGlow",
    "costFrame",
    "autoOff",
    "autoOn",
    "speed1",
    "speed2",
    "skipButton",
    "backButton",
    "countFrame",
    "bottomLine",
    "chestRune",
    "winText",
    "expFrame",
    "expIcon",
    "goldIcon",
    "levelTitle",
    "levelGlow",
  ])
    $("#game").style.setProperty("--" + key, `url("${ART[key].src}")`);
  HEROES.forEach((h) => portraits.set(h.id, portrait(h.sprite)));
  closedChest = chestImage(false);
  openChest = chestImage(true);
  $("#loading").hidden = true;
  function toast(message) {
    clearTimeout(toastTimer);
    $("#toast").textContent = message;
    $("#toast").classList.add("show");
    toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 2400);
  }
  function persist() {
    save.formation = [...state.formation];
    if (!writeSave(save)) toast("浏览器未允许保存，本次仍可游玩");
    $("#audio").classList.toggle("sound-on", save.sound);
    $("#audio").setAttribute(
      "aria-label",
      save.sound ? "关闭声音" : "开启声音",
    );
  }
  function setMode(mode) {
    state.mode = mode;
    sound.setScene(
      mode === "battle"
        ? state.stage === 3
          ? "boss"
          : "battle"
        : mode === "result"
          ? result?.victory
            ? "victory"
            : "defeat"
          : mode === "formation"
            ? "formation"
            : null,
    );
    if (mode !== "formation") roster.close();
    if (mode !== "battle") {
      state.countdown = 0;
      $("#fightBanner").hidden = true;
    }
    $("#extrasMenu").hidden = true;
    $("#more").setAttribute("aria-expanded", "false");
    $("#game").dataset.mode = mode;
    const formation = mode === "formation",
      battle = mode === "battle";
    $("#formationBar").hidden = !formation;
    $("#training").hidden = !formation;
    $("#mainCharacter").hidden = !formation;
    $("#heroSkillBar").hidden = !battle;
    $("#bossChallenge").hidden = !formation;
    $("#formationCount").hidden = !formation;
    $("#combatBar").hidden = formation || mode === "loading";
    $("#currency").hidden = formation;
    $("#pause").hidden = !battle;
    $("#roundLabel").hidden = !battle;
    $("#stageTitle").hidden = mode === "loading";
    $("#back").hidden = mode === "loading";
    $("#coinCount").textContent =
      mode === "result" && result?.victory ? result.gold : 0;
    if (formation) updateFormation();
  }
  function updateFormation() {
    $("#formationCount b").textContent =
      5 - state.formation.filter(Boolean).length;
    state.level = levelFor(save.xp);
    persist();
  }
  function changeStage(id) {
    state.stage = id;
    state.difficulty = 0;
    $("#stageName").textContent = STAGES[id].name;
    $("#stageNumber").innerHTML = STAGES[id].chapter + " <i>★</i>";
    updateFormation();
  }
  function deploy(id, slot) {
    if (state.mode !== "formation") return;
    const r = placeHero(state.formation, id, slot);
    if (!r.ok) return toast(r.reason);
    state.formation = r.formation;
    state.selected = id;
    updateFormation();
    sound.play();
    if (activeModal === "heroes") showHeroManager();
    roster.render();
    toast(`${getHero(id).name}已就位`);
  }
  function bench(id) {
    const r = removeHero(state.formation, id);
    if (!r.ok) return toast(r.reason);
    state.formation = r.formation;
    updateFormation();
    if (activeModal === "heroes") showHeroManager();
    roster.render();
    toast("英雄已撤下，可从列表重新上阵");
  }
  function showModal(type, html) {
    roster.close();
    resetDrag();
    clearTimeout(toastTimer);
    $("#toast").classList.remove("show");
    activeModal = type;
    if ($("#overlay").hidden) previousFocus = document.activeElement;
    $("#overlayContent").innerHTML = html;
    $("#overlay").hidden = false;
    $("#overlay").setAttribute("role", "dialog");
    $("#overlay").setAttribute("aria-modal", "true");
    $("#overlay").setAttribute(
      "aria-label",
      type === "result" ? "战斗结算" : "游戏窗口",
    );
    $("#overlayContent").querySelector("button:not(:disabled)")?.focus();
  }
  function closeModal() {
    if (activeModal === "pause" && !state.paused && state.mode === "battle")
      sound.setScene(state.stage === 3 ? "boss" : "battle");
    activeModal = null;
    $("#overlay").hidden = true;
    $("#overlayContent").innerHTML = "";
    previousFocus?.focus?.();
    previousFocus = null;
  }
  const frame = (title, content, classes = "") =>
    `<section class="window ${classes}"><div class="window-title">${title}</div><button class="close" data-close aria-label="关闭">×</button>${content}</section>`;
  function showMap() {
    if (state.mode === "battle") {
      showRetreat();
      return;
    }
    const points = [
      { x: 100, y: 251, label: "1-1", done: true },
      { x: 203, y: 112, label: "1-2", done: true },
      { x: 339, y: 123, label: "1-3", done: true },
      { x: 327, y: 251, label: "1-4", stage: 0 },
      { x: 417, y: 373, label: "1-5", stage: 1 },
      { x: 518, y: 249, label: "1-6", stage: 2 },
      { x: 645, y: 250, label: "1-7", locked: true },
      { x: 645, y: 115, label: "1-8", locked: true },
      { x: 754, y: 251, label: "1-9", locked: true },
    ];
    showModal(
      "map",
      frame(
        "德玛西亚",
        `<svg class="map-path" viewBox="0 0 760 365"><g fill="none" stroke="#65533e" stroke-width="5"><path d="M65 201L168 62L304 73L292 201L382 323L483 199L610 200L610 65M610 200L719 201"/></g><g fill="none" stroke="#cab78c" stroke-width="1"><path d="M65 201L168 62L304 73L292 201L382 323L483 199L610 200L610 65M610 200L719 201"/></g></svg>${points.map((p) => `<button class="map-node ${p.stage === state.stage ? "current" : ""} ${p.locked ? "locked" : ""}" style="left:${p.x}px;top:${p.y}px" ${p.done ? "data-completed" : p.stage !== undefined ? `data-stage="${p.stage}"` : ""} ${p.locked || p.stage > save.unlocked ? "disabled" : ""} aria-label="关卡 ${p.label}"><span class="badge">${mapIcon(p.locked || p.stage > save.unlocked ? "lock" : p.done ? "helmet" : "banner")}</span><span class="node-name">${p.label}</span><span class="node-stars">${p.done ? "★" : save.stars[p.stage] ? "★".repeat(Math.min(2, save.stars[p.stage])) : p.stage === state.stage ? "★★" : ""}</span></button>`).join("")}<span class="map-caption">点击关卡进入布阵　·　已通关 ${[0, 1, 2].filter((id) => save.stars[id]).length} / 3</span><span class="map-caption" style="left:auto;right:30px">⚡ 35/35</span>`,
        "map-window",
      ),
    );
  }
  function mapIcon(type) {
    const lock = type === "lock";
    return `<svg viewBox="0 0 70 65" aria-hidden="true"><defs><linearGradient id="nodeMetal"><stop stop-color="#e8e6c6"/><stop offset=".4" stop-color="#798b96"/><stop offset=".7" stop-color="#e1e3d6"/><stop offset="1" stop-color="#526270"/></linearGradient><linearGradient id="nodeBlue"><stop stop-color="#8ed4fb"/><stop offset=".5" stop-color="#1847b1"/><stop offset="1" stop-color="#041f5d"/></linearGradient><linearGradient id="nodeGold"><stop stop-color="#ffffa0"/><stop offset=".5" stop-color="#ffb629"/><stop offset="1" stop-color="#bd2d18"/></linearGradient></defs>${lock ? '<path d="M23 26V16C23 2 47 2 47 16V28" fill="none" stroke="#28313d" stroke-width="11"/><path d="M23 26V16C23 2 47 2 47 16V28" fill="none" stroke="url(#nodeMetal)" stroke-width="6"/><rect x="14" y="25" width="42" height="34" rx="12" fill="url(#nodeMetal)" stroke="#293944" stroke-width="3"/><circle cx="35" cy="39" r="5" fill="#2d3943"/><path d="M33 40L31 50H39L37 40" fill="#2d3943"/>' : `<path d="M20 25L5 21 9 8 18 17 26 15M50 25L65 21 61 8 52 17 44 15" fill="url(#nodeMetal)" stroke="#383c49" stroke-width="2"/><path d="M17 20Q35 3 53 20L49 49 35 59 21 49Z" fill="${type === "banner" ? "url(#nodeGold)" : "url(#nodeBlue)"}" stroke="#e6cca0" stroke-width="3"/><path d="M27 22L26 44 31 47 31 26H39V47L44 44 43 22Z" fill="url(#nodeMetal)"/><path d="M32 8H38V24H32Z" fill="#fff7a5"/>`}</svg>`;
  }
  function showDifficulty() {
    const stage = STAGES[state.stage];
    showModal(
      "difficulty",
      frame(
        "关卡难度选择",
        `<div class="difficulty-panels">${[0, 1].map((hard) => `<section class="difficulty-card"><div class="difficulty-stars">${hard ? "★★" : "★"}</div><div class="difficulty-power">⚔　${hard ? "11703" : "10700"}</div><div class="difficulty-rewards"><b>EXP</b> ${stage.xp + (hard ? 10 : 0)}　<span>◉</span> ${stage.gold + (hard ? 4 : 0)}</div><h3>概率掉落</h3><div class="difficulty-loot"><i>◆</i><i>✧</i><i>♜</i></div>${hard && !save.stars[state.stage] ? '<div class="difficulty-lock">' + mapIcon("lock") + "<small>普通难度通关后解锁</small></div>" : '<p class="difficulty-desc">' + (hard ? "敌人生命 +25%<br>敌人攻击 +15%" : "普通难度<br>推荐首次挑战") + "</p>"}<button class="ornate ${hard ? "blue" : "gold"}" data-difficulty="${hard}" ${hard && !save.stars[state.stage] ? "disabled" : ""}>挑战</button></section>`).join("")}</div><span class="compact-note">本地演示关卡 · 不消耗体力</span>`,
        "difficulty-window",
      ),
    );
    root.querySelectorAll("[data-difficulty]").forEach(
      (button) =>
        (button.onclick = () => {
          state.difficulty = Number(button.dataset.difficulty);
          $("#stageNumber").innerHTML =
            stage.chapter + " <i>" + "★".repeat(state.difficulty + 1) + "</i>";
          closeModal();
          toast(
            state.difficulty
              ? "精英难度已选择，请调整队伍"
              : "普通难度，准备开始战斗",
          );
        }),
    );
  }
  function showHeroManager() {
    const chosen = getHero(state.selected);
    showModal(
      "heroes",
      frame(
        "更换英雄",
        `<p class="window-description">点击英雄，再选择阵位。已有英雄会被替换；最多上阵 5 人。</p><div class="hero-list">${HEROES.filter(
          (h) => !isProtagonist(h.id) || state.formation.includes(h.id),
        )
          .map(
            (h) =>
              `<button class="hero-card ${state.selected === h.id ? "selected" : ""}" data-hero="${h.id}" aria-pressed="${state.selected === h.id}"><img src="${portraits.get(h.id)}" alt="${h.name}"><strong style="color:${h.color}">${h.name}</strong><small>${h.role} · Lv.${isProtagonist(h.id) ? state.level : save.heroProgress[h.id].level}</small><span class="deployed">${isProtagonist(h.id) ? "主角 · 必须出战" : state.formation.includes(h.id) ? "已上阵" : "可上阵"}</span></button>`,
          )
          .join(
            "",
          )}</div><div class="hero-description"><strong style="color:${chosen.color}">${chosen.name} · ${chosen.skill}</strong><br>${chosen.description}${HERO_SKILLS[chosen.id] ? "<br>英雄技：" + HERO_SKILLS[chosen.id].name + " · " + HERO_SKILLS[chosen.id].description : ""}</div><div class="slot-grid">${state.formation.map((id, i) => `<button data-slot="${i}" class="${id === state.selected ? "selected" : ""}" aria-label="第${i + 1}阵位">${id ? getHero(id).name : "空位"}</button>`).join("")}</div><div class="window-footer" style="text-align:right"><button class="ornate blue" id="heroTraining">英雄强化</button>　<button class="ornate blue" id="bench" ${!isProtagonist(state.selected) && state.formation.includes(state.selected) ? "" : "disabled"}>撤下英雄</button>　<button class="ornate gold" data-close>完成</button></div>`,
        "hero-window",
      ),
    );
    $("#bench").onclick = () => bench(state.selected);
    $("#heroTraining").textContent = isProtagonist(state.selected)
      ? "主角技能"
      : "英雄强化";
    $("#heroTraining").onclick = () =>
      isProtagonist(state.selected)
        ? mainPanel.open()
        : training.open(state.selected);
  }
  function showArrange() {
    const patterns = [
      { name: "均衡阵型", ids: [...DEFAULT_FORMATION] },
      {
        name: "前排突击",
        ids: [
          null,
          "ranger",
          "sun",
          null,
          "pirate",
          "blade",
          null,
          null,
          "rogue",
        ],
      },
      {
        name: "后排集火",
        ids: [
          "ranger",
          null,
          "sun",
          "pirate",
          null,
          "blade",
          null,
          "rogue",
          null,
        ],
      },
    ];
    showModal(
      "arrange",
      frame(
        "调整阵型",
        `<p class="window-description">也可以直接在战场拖动英雄，松手后交换阵位。</p><div class="formation-options">${patterns.map((p, i) => `<button class="formation-option" data-pattern="${i}"><span>${p.ids.map((id) => `<i class="${id ? "filled" : ""}"></i>`).join("")}</span><strong>${p.name}</strong></button>`).join("")}</div>`,
        "formation-window",
      ),
    );
    root.querySelectorAll("[data-pattern]").forEach(
      (el) =>
        (el.onclick = () => {
          const main = state.formation.find(isProtagonist);
          state.formation = patterns[Number(el.dataset.pattern)].ids.map(
            (id) => (id === "ranger" ? main : id),
          );
          updateFormation();
          closeModal();
          toast("阵型已调整，拖动英雄可继续微调");
        }),
    );
  }
  function showAssist() {
    showModal(
      "assist",
      frame(
        "好友助阵",
        `<p class="window-description">选择一位助战英雄加入小队。</p><div class="friend-row"><img src="${portraits.get("sun")}" alt="好友头像"><div><strong><span class="vip">VIP4</span>灿烂的星光</strong><small>等级：8　　战力：1351</small></div><div class="friend-mini">${["rogue", "pirate", "blade"].map((id) => `<img src="${portraits.get(id)}" alt="${getHero(id).name}">`).join("")}</div><button class="ornate blue" data-assist="blade">出战</button></div><div class="friend-row"><img src="${portraits.get("wind")}" alt="好友头像"><div><strong><span class="vip">VIP0</span>水晶女王</strong><small>等级：7　　战力：1189</small></div><div class="friend-mini"><img src="${portraits.get("wind")}" alt="风之女"></div><button class="ornate blue" data-assist="wind">出战</button></div><span class="compact-note">本地演示好友 · 助战英雄将替换一名队员，可在「更换英雄」中调整</span>`,
      ),
    );
    root.querySelectorAll("[data-assist]").forEach(
      (el) =>
        (el.onclick = () => {
          const id = el.dataset.assist;
          deploy(
            id,
            state.formation.includes(id)
              ? state.formation.indexOf(id)
              : state.formation.findIndex((x) => x && !isProtagonist(x)),
          );
          closeModal();
          toast(`${getHero(id).name}已加入助阵`);
        }),
    );
  }
  function showHelp() {
    showModal(
      "help",
      frame(
        "操作说明",
        `<div class="help-copy"><b>布阵：</b>拖动英雄到箭头阵位，重叠即换位；点英雄后点空位也可部署。<br><b>战斗：</b>从前排第一阵位开始，按双方阵位顺序轮流行动，点底部技能进行指挥。<br><b>技能：</b>底部三个技能点击后在主角自己的行动位释放，再点同一技能可取消预选；空槽保留原画面布局。在「主角技能」中更换出战技能。普通英雄从首次行动起按「技能→普攻→普攻」循环，卡塔琳娜会前移旋转并返回阵位。<br><b>结算：</b>胜利后选择一个宝箱，领取奖励，再进入下一关。<br><small>1–3 主角技能 · 空格暂停 · Esc 关闭窗口 / 取消选目标<br>游侠、战士、法师选择其一出战。美术与技能资料来自参考包，完整战斗数值为本地 Demo 规则。</small></div><div class="window-footer"><button class="ornate gold" data-close>知道了</button></div>`,
        "help-window",
      ),
    );
  }
  function showRetreat() {
    showModal(
      "retreat",
      frame(
        "退出战斗",
        `<p>确定退出本次战斗？</p><div class="pause-actions"><button class="ornate blue" data-close>继续战斗</button><button class="ornate gold" id="confirmRetreat">重新布阵</button></div>`,
        "pause-window",
      ),
    );
    $("#confirmRetreat").onclick = () => {
      closeModal();
      returnFormation();
    };
  }
  function togglePause() {
    if (state.mode !== "battle") return;
    if (state.paused) {
      state.paused = false;
      sound.setScene(state.stage === 3 ? "boss" : "battle");
      closeModal();
      return;
    }
    state.paused = true;
    sound.setScene(null);
    showModal(
      "pause",
      frame(
        "战斗暂停",
        `<p>战斗已暂停</p><div class="pause-actions"><button class="ornate gold" id="resume">继续战斗</button></div>`,
        "pause-window",
      ),
    );
    $("#resume").onclick = () => {
      state.paused = false;
      sound.setScene(state.stage === 3 ? "boss" : "battle");
      closeModal();
    };
  }
  function resetDrag() {
    state.drag = null;
  }
  listen(field, "pointerdown", (e) => {
    if (e.button !== 0 || activeModal) return;
    sound.unlock();
    const p = view.point(e),
      hit = view.hit(p);
    if (state.mode === "battle") {
      if (state.targeting && hit?.unit.side === "enemy" && hit.unit.hp > 0)
        queueSpell(state.targeting, hit.id);
      return;
    }
    if (state.mode !== "formation") return;
    if (hit?.unit.side === "ally") {
      state.selected = hit.id;
      state.drag = {
        id: hit.id,
        startX: e.clientX,
        startY: e.clientY,
        pointer: e.pointerId,
        active: false,
        x: p.x,
        y: p.y,
        slot: null,
      };
      field.setPointerCapture(e.pointerId);
    } else if (hit?.unit.side === "enemy")
      toast(
        `${hit.unit.name}　生命 ${hit.unit.maxHp}　攻击 ${hit.unit.attack}`,
      );
    else {
      const slot = view.slotAt(p);
      if (slot !== null) deploy(state.selected, slot);
    }
  });
  listen(field, "pointermove", (e) => {
    const d = state.drag;
    if (!d || d.pointer !== e.pointerId) return;
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 5)
      d.active = true;
    if (!d.active) return;
    const p = view.point(e);
    d.x = p.x;
    d.y = p.y;
    d.slot = view.slotAt(p);
  });
  listen(document, "pointerup", (e) => {
    const d = state.drag;
    if (!d || d.pointer !== e.pointerId) return;
    const p = view.point(e),
      slot = view.slotAt(p);
    if (d.active) {
      if (slot !== null && p.x >= 0 && p.x <= 580 && p.y >= 160 && p.y < 470)
        deploy(d.id, slot);
      else toast("已取消移动，阵型保持不变");
    } else toast(`${getHero(d.id).name} · ${getHero(d.id).description}`);
    resetDrag();
  });
  listen(document, "pointercancel", resetDrag);
  listen(field, "lostpointercapture", resetDrag);
  listen(root, "click", (e) => {
    const close = e.target.closest("[data-close]");
    if (close) {
      if (activeModal === "pause") state.paused = false;
      closeModal();
      return;
    }
    const hero = e.target.closest("[data-hero]");
    if (hero) {
      state.selected = hero.dataset.hero;
      showHeroManager();
      return;
    }
    const slot = e.target.closest("[data-slot]");
    if (slot) {
      deploy(state.selected, Number(slot.dataset.slot));
      return;
    }
    const stage = e.target.closest("[data-stage]");
    if (stage && !stage.disabled) {
      changeStage(Number(stage.dataset.stage));
      showDifficulty();
      return;
    }
    if (e.target.closest("[data-completed]"))
      toast("此为已完成的前置关卡，请挑战 1-4 至 1-6");
  });
  const training = createTraining({
    root,
    save,
    portraits,
    art: ART,
    showModal,
    frame,
    persist,
    onFormation: showHeroes,
    play: (kind) => sound.play(kind),
  });
  const mainPanel = createMainPanel({
    root,
    save,
    state,
    art: ART,
    showModal,
    frame,
    onChange: updateFormation,
  });
  $("#mainCharacter").onclick = () => mainPanel.open();
  $("#training").onclick = () => training.open();
  $("#bossChallenge").onclick = () => {
    showModal(
      "boss",
      frame(
        "狼王降临",
        `<div class="boss-intro"><img src="${ART.bossHead.src}" alt="狂暴狼王"><div><h2>狂暴狼王 · Lv.10</h2><p>每逢第三回合发动「裂空横扫」，攻击全队。</p><p>生命 6800　·　胜利金币 +150　·　经验卡 +1</p><small>建议携带治疗英雄，提前保留能量应对横扫。</small></div></div><div class="window-footer"><button class="ornate blue" data-close>稍后挑战</button><button class="ornate gold" id="enterBoss">前往布阵</button></div>`,
        "boss-window",
      ),
    );
    $("#enterBoss").onclick = () => {
      changeStage(3);
      closeModal();
      toast("狼王遗迹：调整阵容后开始战斗");
    };
  };
  $("#back").onclick = showMap;
  const roster = createFormationRoster({
    root,
    state,
    save,
    portraits,
    signal: controller.signal,
    select: (id) => {
      state.selected = id;
    },
    bench,
    deploy,
    drag: (id, e) => {
      const p = view.point(e);
      state.drag = { id, active: true, x: p.x, y: p.y, slot: view.slotAt(p) };
    },
    release: (id, e) => {
      if (id && e) {
        const p = view.point(e),
          slot = view.slotAt(p);
        if (slot !== null && p.x <= 580 && p.x >= 0 && p.y >= 160 && p.y < 470)
          deploy(id, slot);
        else toast("已取消移动");
      }
      resetDrag();
    },
    manage: showHeroManager,
    notify: toast,
  });
  function showHeroes() {
    roster.isOpen ? roster.close() : roster.open();
  }
  $("#heroes").onclick = showHeroes;
  $("#arrange").onclick = showArrange;
  $("#assist").onclick = showAssist;
  $("#help").onclick = showHelp;
  $("#audio").onclick = () => {
    save.sound = !save.sound;
    sound.enabled = save.sound;
    sound.unlock();
    sound.play();
    persist();
    toast(save.sound ? "声音已开启" : "声音已关闭");
  };
  function updateBattle() {
    const b = state.battle;
    if (!b) return;
    const allies = b.units.filter((u) => u.side === "ally"),
      main = allies.find((u) => u.category === "protagonist"),
      hp = main?.hp || 0,
      max = main?.maxHp || 1;
    $("#hpValue").textContent = Math.ceil(hp);
    $("#mpValue").textContent = b.energy;
    $("#hpLiquid").style.height = (hp / max) * 100 + "%";
    $("#mpLiquid").style.height = b.energy + "%";
    $("#roundLabel").textContent = `第 ${b.round} 回合`;
    $("#auto").classList.toggle("active", state.auto);
    $("#speed b").textContent = "×" + state.speed;
    $("#speed").style.backgroundImage = `var(--speed${state.speed})`;
    $("#skillBar").innerHTML =
      equippedSpells(b, save.skillLoadouts)
        .map((s, i) => {
          const cd = b.cooldowns[s.id] || 0,
            disabled =
              state.mode !== "battle" ||
              b.energy < s.cost ||
              cd > 0 ||
              !living(b, "ally").some(
                (u) =>
                  u.category === "protagonist" &&
                  !u.silence &&
                  !u.stun &&
                  u.hp > 0,
              ),
            queued = state.pending?.id === s.id || state.targeting === s.id;
          return `<button class="skill ${queued ? "queued active" : ""}" data-spell="${s.id}" ${disabled ? "disabled" : ""} title="${s.name}：${s.description}（快捷键 ${i + 1}）" aria-label="${s.name}">${iconSvg(s.icon)}<span class="skill-name">${s.name}</span><span class="cost">${s.badge}</span>${cd ? `<span class="cooldown">${cd}/${s.cooldown + 1}</span>` : ""}${queued ? '<span class="queue-note">待释放</span>' : ""}</button>`;
        })
        .join("") +
      '<span class="skill empty" aria-label="空技能槽"></span>'.repeat(3);
    $("#heroSkillBar").innerHTML = allies
      .filter((u) => HERO_SKILLS[u.id])
      .map(
        (u) =>
          `<button data-hero-skill="${u.id}" ${u.hp <= 0 || u.silence || b.heroCooldowns[u.id] > 0 ? "disabled" : ""} title="${HERO_SKILLS[u.id].name}：${HERO_SKILLS[u.id].description}" aria-label="${HERO_SKILLS[u.id].name}"><img src="${portraits.get(u.id)}" alt=""><span>${HERO_SKILLS[u.id].name}</span>${b.heroCooldowns[u.id] ? `<b>${b.heroCooldowns[u.id]}</b>` : ""}</button>`,
      )
      .join("");
  }
  function startBattle() {
    closeModal();
    sound.unlock();
    resetDrag();
    state.battle = createBattle(
      state.formation,
      state.stage,
      state.level,
      state.difficulty,
      save.heroProgress,
    );
    refillQueue(state.battle);
    state.anim = null;
    state.targeting = null;
    state.pending = null;
    state.paused = false;
    state.wait = 700;
    state.loading = 0;
    result = null;
    $("#targetHint").hidden = true;
    setMode("loading");
  }
  function beginBattle() {
    setMode("battle");
    updateBattle();
    $("#fightBanner").hidden = false;
    clearTimeout(bannerTimer);
    state.countdown = 3600;
    $("#fightBanner").textContent = "3";
    sound.play("spell");
  }
  function cancelTarget() {
    state.targeting = null;
    $("#targetHint").hidden = true;
    updateBattle();
  }
  function selectSpell(id) {
    if (state.mode !== "battle") return;
    const b = state.battle,
      s = SPELLS.find((s) => s.id === id);
    if (!s) return;

    if (b.cooldowns[id]) return toast("技能冷却中");
    if (b.energy < s.cost) return toast("能量不足，可先释放产能技能");
    // In the footage, a tap commands the skill without stopping for a second target tap.
    const target = living(b, "enemy").sort(
      (a, c) => (a.slot % 3) - (c.slot % 3) || a.slot - c.slot,
    )[0];
    queueSpell(id, target?.id);
  }
  function queueSpell(id, target) {
    state.pending = state.pending?.id === id ? null : { id, target };
    state.targeting = null;
    $("#targetHint").hidden = true;
    updateBattle();
    sound.play();
  }
  function command(id, target) {
    return id.startsWith("hero:")
      ? heroSkillAction(state.battle, id.slice(5))
      : spellAction(state.battle, id, target);
  }
  function launch(action) {
    const timeline = prepareActionTimeline(state.battle, action);
    state.anim = {
      action,
      elapsed: 0,
      duration: timeline.duration,
      timeline,
      applied: false,
      appliedHits: 0,
    };
    root.dispatchEvent(
      new CustomEvent("battleaction", {
        detail: {
          actor: action.actor,
          kind: action.kind,
          round: state.battle.round,
          duration: state.anim.duration,
          nativeId: action.nativeId,
          side: state.battle.units.find((u) => u.id === action.actor)?.side,
          slot: state.battle.units.find((u) => u.id === action.actor)?.slot,
          hitTimes: timeline.events.map((event) => event.at),
        },
      }),
    );
    const caster = state.battle.units.find((u) => u.id === action.actor);
    sound.cast(
      action,
      getHero(caster?.heroSkillId || caster?.id)?.nativeId || caster?.nativeId,
    );
    updateBattle();
  }
  function chooseAuto() {
    const b = state.battle,
      main = living(b, "ally").find((u) => u.category === "protagonist");
    if (!main || main.silence) return null;
    const skills = equippedSpells(b, save.skillLoadouts).filter(
      (s) => !b.cooldowns[s.id] && b.energy >= s.cost,
    );
    const heal = skills.find(
      (s) => s.healing && living(b, "ally").some((u) => u.hp / u.maxHp < 0.6),
    );
    return (
      heal?.id ||
      skills.find((s) => s.cost === 50)?.id ||
      skills.find((s) => s.gain)?.id ||
      null
    );
  }
  function actionForActor(actor) {
    const b = state.battle;
    const pending = state.pending;
    const controlsActor =
      pending &&
      (pending.id.startsWith("hero:")
        ? pending.id.slice(5) === actor.id
        : actor.side === "ally" && actor.category === "protagonist");
    const pendingCooling = pending?.id.startsWith("hero:")
      ? b.heroCooldowns[actor.id]
      : b.cooldowns[pending?.id];
    if (controlsActor && !actor.silence && !actor.stun && !pendingCooling) {
      const target =
        living(b, "enemy").find((u) => u.id === pending.target) ||
        living(b, "enemy").sort(
          (a, c) => (a.slot % 3) - (c.slot % 3) || a.slot - c.slot,
        )[0];
      const action = command(pending.id, target?.id);
      if (!action.error) {
        state.pending = null;
        return action;
      }
      toast(action.error);
    }
    if (
      state.auto &&
      actor.side === "ally" &&
      actor.category === "protagonist"
    ) {
      const id = chooseAuto();
      if (id) {
        const action = command(id, living(b, "enemy")[0]?.id);
        if (!action.error) return action;
      }
    }
    return basicAction(b, actor);
  }
  function tickBattle(dt) {
    const b = state.battle;
    if (!b || state.paused || activeModal || state.targeting) return;
    if (state.countdown > 0) {
      state.countdown = Math.max(0, state.countdown - dt);
      $("#fightBanner").textContent =
        state.countdown > 600
          ? String(Math.ceil((state.countdown - 600) / 1000))
          : "FIGHT!";
      $("#fightBanner").hidden = state.countdown === 0;
      return;
    }
    if (state.anim) {
      const a = state.anim;
      a.elapsed += dt;
      const total = a.action.targets.length;
      const due = dueNativeHits(a.timeline, a.elapsed);
      if (due > a.appliedHits) {
        applyAction(b, a.action, a.appliedHits, due, due === total);
        for (const h of a.action.targets.slice(a.appliedHits, due)) {
          view.float(
            h.blessingBlock
              ? "格挡提升"
              : h.shield
                ? "护盾"
                : h.reflect
                  ? "反伤"
                  : `${h.blocked ? "格挡 " : h.critical ? "暴击 " : ""}${h.heal ? "+" : "−"}${h.amount}`,
            h.id,
            h.heal || h.shield || h.reflect || h.blessingBlock
              ? "#88ff49"
              : "#ff743b",
          );
          if (h.status)
            view.float(
              { stun: "冰封", poison: "剧毒", silence: "沉默" }[h.status],
              h.id,
              "#9edfff",
            );
        }
        a.appliedHits = due;
        a.applied = due === total;
        sound.impact(a.action);
        updateBattle();
      }
      if (a.elapsed >= a.duration) {
        state.anim = null;
        state.wait = 100;
        if (b.outcome) finishBattle();
      }
      return;
    }
    state.wait -= dt;
    if (state.wait > 0) return;
    if (b.outcome) {
      finishBattle();
      return;
    }
    if (!b.queue.some((id) => b.units.find((u) => u.id === id)?.hp > 0)) {
      beginNextRound(b);
      updateBattle();
      if (b.outcome) finishBattle();
      state.wait = 350;
      return;
    }
    const actor = nextActor(b);
    if (actor) {
      const action = actionForActor(actor);
      if (action) launch(action);
    } else if (b.outcome) finishBattle();
  }
  function skipBattle() {
    if (state.mode !== "battle") return;
    showModal(
      "skip",
      frame(
        "跳过战斗",
        `<p>按当前阵容结算剩余战斗？</p><div class="pause-actions"><button class="ornate blue" data-close>继续观看</button><button class="ornate gold" id="confirmSkip">跳过动画</button></div>`,
        "pause-window",
      ),
    );
    $("#confirmSkip").onclick = () => {
      closeModal();
      const b = state.battle;
      if (state.anim && !state.anim.applied)
        applyAction(b, state.anim.action, state.anim.appliedHits || 0);
      state.anim = null;
      cancelTarget();
      let steps = 0;
      while (!b.outcome && steps++ < 1500) {
        const actor = nextActor(b);
        if (actor) {
          const a = actionForActor(actor);
          if (a) applyAction(b, a);
        } else if (!b.outcome) beginNextRound(b);
      }
      finishBattle();
    };
  }
  function returnFormation() {
    state.battle = null;
    state.anim = null;
    state.pending = null;
    state.targeting = null;
    state.paused = false;
    view.floats = [];
    $("#targetHint").hidden = true;
    $("#fightBanner").hidden = true;
    setMode("formation");
    updateFormation();
  }
  function finishBattle() {
    if (state.mode !== "battle") return;
    const b = state.battle,
      s = STAGES[state.stage],
      victory = b.outcome === "victory",
      oldLevel = levelFor(save.xp);
    result = {
      victory,
      oldLevel,
      claimed: false,
      choice: null,
      gold: victory ? s.gold + (state.difficulty ? 4 : 0) : 0,
      xp: victory ? s.xp + (state.difficulty ? 10 : 0) : 0,
      stars:
        living(b, "ally").length ===
        b.units.filter((u) => u.side === "ally").length
          ? 2
          : 1,
      started: performance.now(),
      levelShown: false,
    };
    if (victory) {
      save.trainingCards = Math.min(9999, save.trainingCards + 1);
      save.gold += result.gold;
      save.xp += result.xp;
      if (!s.boss)
        save.unlocked = Math.min(2, Math.max(save.unlocked, state.stage + 1));
      save.stars[state.stage] = Math.max(
        save.stars[state.stage] || 0,
        result.stars,
      );
      persist();
      sound.play("win");
    }
    setMode("result");
    state.pending = null;
    cancelTarget();
    renderResult();
  }
  function confetti() {
    return `<div class="confetti" aria-hidden="true">${Array.from({ length: 34 }, (_, i) => `<i style="--x:${(i * 59) % 100}%;--delay:${i * 0.11}s;--color:${["#ffde4c", "#ef70c8", "#89efff", "#a3fc7a"][i % 4]}"></i>`).join("")}</div>`;
  }
  function renderResult() {
    const r = result,
      up = levelFor(save.xp) > r.oldLevel;
    showModal(
      "result",
      `<section class="result-screen ${r.victory ? "" : "result-defeat"} ${r.claimed ? "claimed" : ""}"><div class="result-band"></div><img class="result-portrait" src="${ART.victory.src}" alt="霜火枪姬胜利立绘"><div class="result-title">${r.victory ? "大获全胜" : "战斗失利"}</div><div class="result-stars">${r.victory ? "★".repeat(r.stars) + `<span class="dim">${"★".repeat(2 - r.stars)}</span>` : ""}</div>${r.victory ? `<div class="reward-line"><div><i class="exp">EXP</i><span id="rewardXp" class="reward-box">+${r.xp}</span></div><div><i class="coin">◉</i><span id="rewardGold" class="reward-box">+${r.gold}</span></div></div><div class="xp-bar"><i style="width:${((save.xp % 62) / 62) * 100}%"></i><span>经验　${save.xp % 62}/62</span></div><div class="chest-prompt">${r.claimed ? "奖励已领取" : "请选择一个宝箱，抽取您的奖励"}</div><div class="chest-row">${[0, 1, 2].map((i) => `<button class="chest-button ${r.choice === i ? "selected" : ""}" data-chest="${i}" ${r.claimed ? "disabled" : ""} aria-label="选择第${i + 1}个宝箱"><span class="rune"></span><img src="${r.claimed ? openChest : closedChest}" alt="${r.claimed ? "已打开宝箱" : "宝箱"}">${r.choice === i ? `<span class="reward-label">${r.rewardText}</span>` : ""}</button>`).join("")}</div><div class="result-actions" ${r.claimed ? "" : "hidden"}><button class="ornate blue" id="resultMap">退出</button><button class="ornate gold" id="nextStage">${state.stage === 3 ? "返回布阵" : state.stage < 2 ? "下一关" : "再挑战"}</button></div>${confetti()}` : `<div class="chest-prompt">${state.battle.round > 30 ? "战斗超过 30 回合。" : "英雄暂时倒下了。"}<br>调整前排位置，或让「风之女」加入队伍提供治疗。</div><div class="result-actions"><button class="ornate blue" id="retryFormation">调整阵型</button><button class="ornate gold" id="retry">再次挑战</button></div>`}</section>`,
    );
    if (r.victory) {
      root
        .querySelectorAll("[data-chest]")
        .forEach(
          (el) => (el.onclick = () => claimChest(Number(el.dataset.chest))),
        );
      if (r.claimed) {
        $("#resultMap").onclick = () => {
          closeModal();
          returnFormation();
          showMap();
        };
        $("#nextStage").onclick = () => {
          const next = state.stage === 3 ? 0 : Math.min(2, state.stage + 1);
          closeModal();
          returnFormation();
          changeStage(next);
        };
      }
    } else {
      $("#retryFormation").onclick = () => {
        closeModal();
        returnFormation();
      };
      $("#retry").onclick = startBattle;
    }
    if (r.victory && r.claimed) {
      const prize = document.createElement("div");
      prize.className = "chest-prize";
      prize.innerHTML = `<img src="${(r.choice === 1 ? ART.crystalIcon : ART.goldIcon).src}" alt=""><b>${r.rewardText}</b>`;
      $(".result-screen").append(prize);
    }
    if (r.claimed && up && !r.levelShown) {
      r.levelShown = true;
      const level = document.createElement("div");
      level.className = "level-popup";
      level.innerHTML = `<div class="level-halo"></div><h2>LEVEL UP</h2><img src="${portraits.get(state.formation.find(isProtagonist))}" alt="主角升级"><strong>Lv.${levelFor(save.xp)}</strong><p>玩家等级提升 · 英雄可通过经验卡强化</p><button class="ornate gold" id="levelConfirm">确定</button>`;
      $("#overlayContent").append(level);
      $("#levelConfirm").onclick = () => {
        level.remove();
        sound.play("win");
      };
    }
  }
  function claimChest(index) {
    if (!result?.victory || result.claimed) return;
    const options = [
        { gold: 30, crystals: 0, text: "金币 +30" },
        { gold: 0, crystals: 10, text: "星晶 +10" },
        { gold: 15, crystals: 5, text: "金币 +15 · 星晶 +5" },
      ],
      r = options[index];
    result.claimed = true;
    result.choice = index;
    result.rewardText = r.text;
    save.gold += r.gold;
    save.crystals += r.crystals;
    persist();
    sound.play("win");
    renderResult();
  }
  $("#fight").onclick = startBattle;
  $("#pause").onclick = togglePause;
  $("#skip").onclick = skipBattle;
  $("#cancelTarget").onclick = cancelTarget;
  $("#auto").onclick = () => {
    state.auto = !state.auto;
    cancelTarget();
    updateBattle();
    toast(state.auto ? "自动战斗已开启" : "可手动释放英雄技能");
  };
  $("#speed").onclick = () => {
    state.speed = state.speed === 1 ? 2 : 1;
    updateBattle();
  };
  $("#heroSkillBar").onclick = (e) => {
    const button = e.target.closest("[data-hero-skill]");
    if (!button || button.disabled) return;
    queueSpell("hero:" + button.dataset.heroSkill);
  };
  $("#skillBar").onclick = (e) => {
    const button = e.target.closest("[data-spell]");
    if (button && !button.disabled) selectSpell(button.dataset.spell);
  };
  listen(window, "keydown", (e) => {
    if (activeModal) {
      if (e.key === "Escape" && $("#cancelFeed")) {
        e.preventDefault();
        $("#cancelFeed").click();
        return;
      }
      if (e.key === "Escape" && activeModal === "training-picker") {
        e.preventDefault();
        training.open();
        return;
      }
      if (e.key === "Escape" && !["result"].includes(activeModal)) {
        e.preventDefault();
        if (activeModal === "pause") state.paused = false;
        closeModal();
      }
      if (e.key === "Tab") {
        const buttons = [
          ...($(".consume-window") || $("#overlayContent")).querySelectorAll(
            "button:not(:disabled), input:not(:disabled)",
          ),
        ];
        if (buttons.length) {
          const first = buttons[0],
            last = buttons.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
      return;
    }
    if (e.key === "Escape") {
      roster.close();
      cancelTarget();
    }
    if (state.mode === "battle") {
      if (e.code === "Space") {
        e.preventDefault();
        togglePause();
      }
      if (/^[1-3]$/.test(e.key))
        selectSpell(
          equippedSpells(state.battle, save.skillLoadouts)[Number(e.key) - 1]
            .id,
        );
    } else if (
      state.mode === "formation" &&
      document.activeElement === field &&
      /^[1-9]$/.test(e.key)
    ) {
      e.preventDefault();
      deploy(state.selected, Number(e.key) - 1);
    }
  });
  listen(document, "visibilitychange", () => {
    if (!document.hidden && !state.paused) {
      sound.setScene(
        state.mode === "formation"
          ? "formation"
          : state.mode === "battle"
            ? state.stage === 3
              ? "boss"
              : "battle"
            : state.mode === "result"
              ? result?.victory
                ? "victory"
                : "defeat"
              : null,
      );
    }
    if (document.hidden) {
      sound.setScene(null);
      resetDrag();
      if (state.mode === "battle" && !state.paused && !activeModal)
        togglePause();
    }
  });
  function tick(now) {
    if (disposed) return;
    const dt = Math.min(60, now - last);
    last = now;
    if (state.mode === "loading") {
      state.loading += dt;
      if (state.loading >= 850) beginBattle();
    } else if (state.mode === "battle") tickBattle(dt * state.speed);
    if (
      state.mode === "result" &&
      result?.victory &&
      !result.claimed &&
      $("#rewardGold")
    ) {
      const t = Math.min(1, (now - result.started) / 1100),
        f = 1 - (1 - t) ** 3;
      $("#rewardGold").textContent = "+" + Math.round(result.gold * f);
      $("#rewardXp").textContent = "+" + Math.round(result.xp * f);
    }
    view.render(state, now);
    frameId = requestAnimationFrame(tick);
  }
  persist();
  setMode("formation");
  changeStage(0);
  frameId = requestAnimationFrame(tick);
  return {
    destroy() {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(toastTimer);
      clearTimeout(bannerTimer);
      controller.abort();
      sound.destroy();
      roster.destroy();
      root.querySelectorAll("button").forEach((b) => (b.onclick = null));
      closeModal();
    },
  };
}
