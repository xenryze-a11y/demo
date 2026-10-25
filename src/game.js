import { HEROES, STAGES, SPELLS, DEFAULT_FORMATION, getHero } from "./data.js";
import {
  readSave,
  writeSave,
  levelFor,
  placeHero,
  removeHero,
} from "./state.js";
import {
  createBattle,
  living,
  refillQueue,
  nextActor,
  beginNextRound,
  basicAction,
  spellAction,
  applyAction,
} from "./battle.js";
import { ART, loadArt, portrait, chestImage, iconSvg } from "./art.js";
import { Battlefield } from "./renderer.js";
import { Sound } from "./audio.js";

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
    wait: 0,
    loading: 0,
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
  $("#fullscreen").onclick = fullscreen;
  $("#mobileFull").onclick = fullscreen;
  try {
    await loadArt((completed, total) => {
      if (!$("#retryLoad").hidden) return;
      $("#loading small").textContent = `正在加载场景与英雄… ${completed}/${total}`;
      $("#loading i").style.width = `${completed / total * 100}%`;
    });
  } catch (error) {
    $("#loading small").textContent = "加载未完成，请检查网络后重试";
    $("#retryLoad").hidden = false;
    $("#retryLoad").onclick = () => location.reload();
    return { destroy() { controller.abort(); } };
  }
  if (disposed) return;
  $("#game").style.setProperty("--map-image", `url("${ART.map.src}")`);
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
    $("#game").dataset.mode = mode;
    const formation = mode === "formation",
      battle = mode === "battle";
    $("#formationBar").hidden = !formation;
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
    if (activeModal === "heroes") showHeroes();
    toast(`${getHero(id).name}已就位`);
  }
  function bench(id) {
    const r = removeHero(state.formation, id);
    if (!r.ok) return toast(r.reason);
    state.formation = r.formation;
    updateFormation();
    showHeroes();
    toast("英雄已撤下，可从列表重新上阵");
  }
  function showModal(type, html) {
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
        `<svg class="map-path" viewBox="0 0 760 365"><g fill="none" stroke="#65533e" stroke-width="5"><path d="M65 201L168 62L304 73L292 201L382 323L483 199L610 200L610 65M610 200L719 201"/></g><g fill="none" stroke="#cab78c" stroke-width="1"><path d="M65 201L168 62L304 73L292 201L382 323L483 199L610 200L610 65M610 200L719 201"/></g></svg>${points.map((p) => `<button class="map-node ${p.stage === state.stage ? "current" : ""} ${p.locked ? "locked" : ""}" style="left:${p.x}px;top:${p.y}px" ${p.done ? "data-completed" : p.stage !== undefined ? `data-stage="${p.stage}"` : ""} ${p.locked || p.stage > save.unlocked ? "disabled" : ""} aria-label="关卡 ${p.label}"><span class="badge">${mapIcon(p.locked || p.stage > save.unlocked ? "lock" : p.done ? "helmet" : "banner")}</span><span class="node-name">${p.label}</span><span class="node-stars">${p.done ? "★" : save.stars[p.stage] ? "★".repeat(Math.min(2, save.stars[p.stage])) : p.stage === state.stage ? "★★" : ""}</span></button>`).join("")}<span class="map-caption">点击关卡进入布阵　·　已通关 ${Object.values(save.stars).filter(Boolean).length} / 3</span><span class="map-caption" style="left:auto;right:30px">⚡ 35/35</span>`,
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
  function showHeroes() {
    const chosen = getHero(state.selected);
    showModal(
      "heroes",
      frame(
        "更换英雄",
        `<p class="window-description">点击英雄，再选择阵位。已有英雄会被替换；最多上阵 5 人。</p><div class="hero-list">${HEROES.map((h) => `<button class="hero-card ${state.selected === h.id ? "selected" : ""}" data-hero="${h.id}" aria-pressed="${state.selected === h.id}"><img src="${portraits.get(h.id)}" alt="${h.name}"><strong style="color:${h.color}">${h.name}</strong><small>${h.role} · Lv.${state.level}</small><span class="deployed">${state.formation.includes(h.id) ? "已上阵" : "可上阵"}</span></button>`).join("")}</div><div class="hero-description"><strong style="color:${chosen.color}">${chosen.name} · ${chosen.skill}</strong><br>${chosen.description}</div><div class="slot-grid">${state.formation.map((id, i) => `<button data-slot="${i}" class="${id === state.selected ? "selected" : ""}" aria-label="第${i + 1}阵位">${id ? getHero(id).name : "空位"}</button>`).join("")}</div><div class="window-footer" style="text-align:right"><button class="ornate blue" id="bench" ${state.formation.includes(state.selected) ? "" : "disabled"}>撤下英雄</button>　<button class="ornate gold" data-close>完成</button></div>`,
        "hero-window",
      ),
    );
    $("#bench").onclick = () => bench(state.selected);
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
          state.formation = patterns[Number(el.dataset.pattern)].ids;
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
            state.formation.includes(id) ? state.formation.indexOf(id) : 5,
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
        `<div class="help-copy"><b>布阵：</b>拖动英雄到箭头阵位，重叠即换位；点英雄后点空位也可部署。<br><b>战斗：</b>英雄按速度轮流行动，点底部技能进行指挥。<br><b>技能：</b>审判斩 / 烈阳祝福恢复 20 能量，弹幕风暴消耗 50。<br><b>结算：</b>胜利后选择一个宝箱，领取奖励，再进入下一关。<br><small>1 / 2 / 3 技能 · 空格暂停 · Esc 关闭窗口 / 取消选目标<br>横屏更接近参考录像。美术按录像重绘，战斗数值为可玩 Demo 实现。</small></div><div class="window-footer"><button class="ornate gold" data-close>知道了</button></div>`,
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
      closeModal();
      return;
    }
    state.paused = true;
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
      showHeroes();
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
  $("#back").onclick = showMap;
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
      hp = allies.reduce((s, u) => s + u.hp, 0),
      max = allies.reduce((s, u) => s + u.maxHp, 0);
    $("#hpValue").textContent = Math.ceil(hp);
    $("#mpValue").textContent = b.energy;
    $("#hpLiquid").style.height = (hp / max) * 100 + "%";
    $("#mpLiquid").style.height = b.energy + "%";
    $("#roundLabel").textContent = `第 ${b.round} 回合`;
    $("#auto").classList.toggle("active", state.auto);
    $("#speed b").textContent = "×" + state.speed;
    $("#skillBar").innerHTML =
      SPELLS.map((s, i) => {
        const cd = b.cooldowns[s.id] || 0,
          disabled = state.mode !== "battle" || b.energy < s.cost || cd > 0,
          queued = state.pending?.id === s.id || state.targeting === s.id;
        return `<button class="skill ${queued ? "queued active" : ""}" data-spell="${s.id}" ${disabled ? "disabled" : ""} title="${s.name}：${s.description}（快捷键 ${i + 1}）" aria-label="${s.name}">${iconSvg(s.icon)}<span class="cost">${s.badge}</span>${cd ? `<span class="cooldown">${cd}</span>` : ""}${queued ? '<span class="queue-note">待释放</span>' : ""}</button>`;
      }).join("") +
      Array.from(
        { length: 3 },
        () =>
          '<button class="skill empty" disabled aria-label="未解锁技能"></button>',
      ).join("");
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
    bannerTimer = setTimeout(() => ($("#fightBanner").hidden = true), 1000);
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
    if (state.pending) return toast("已有技能等待释放");
    if (b.cooldowns[id]) return toast("技能冷却中");
    if (b.energy < s.cost) return toast("能量不足，可先释放产能技能");
    if (s.target === "enemy") {
      state.targeting = state.targeting === id ? null : id;
      $("#targetHint").hidden = !state.targeting;
      updateBattle();
    } else queueSpell(id);
  }
  function queueSpell(id, target) {
    state.pending = { id, target };
    state.targeting = null;
    $("#targetHint").hidden = true;
    updateBattle();
    sound.play();
  }
  function command(id, target) {
    const action = spellAction(state.battle, id, target);
    if (action.error) return action;
    const preferred = { comet: "blade", nova: "pirate", spring: "sun" }[id];
    action.actor =
      living(state.battle, "ally").find((u) => u.id === preferred)?.id ||
      action.actor;
    return action;
  }
  function launch(action) {
    state.anim = {
      action,
      elapsed: 0,
      duration: ["attack", "bolt", "heal"].includes(action.kind) ? 720 : 1450,
      applied: false,
    };
    updateBattle();
  }
  function chooseAuto() {
    const b = state.battle;
    const hurt = living(b, "ally").some((u) => u.hp / u.maxHp < 0.7);
    return hurt && !b.cooldowns.spring
      ? "spring"
      : b.energy >= 50 && !b.cooldowns.nova
        ? "nova"
        : !b.cooldowns.comet
          ? "comet"
          : !b.cooldowns.spring && b.energy < 85
            ? "spring"
            : null;
  }
  function tickBattle(dt) {
    const b = state.battle;
    if (!b || state.paused || activeModal || state.targeting) return;
    if (state.anim) {
      const a = state.anim;
      a.elapsed += dt;
      if (!a.applied && a.elapsed >= a.duration * 0.52) {
        a.applied = true;
        applyAction(b, a.action);
        for (const h of a.action.targets) {
          view.float(
            `${h.heal ? "+" : "−"}${h.amount}`,
            h.id,
            h.heal ? "#88ff49" : h.critical ? "#ff6a1f" : "#ef3930",
          );
          if (h.critical) view.float("暴击", h.id, "#ff9f24");
        }
        sound.play(
          ["attack", "bolt"].includes(a.action.kind) ? "hit" : "spell",
        );
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
    if (state.pending) {
      const pending = state.pending;
      state.pending = null;
      const a = command(pending.id, pending.target);
      if (a.error) {
        toast(a.error);
        updateBattle();
      } else {
        launch(a);
        return;
      }
    }
    if (state.auto) {
      const id = chooseAuto();
      if (id) {
        const a = command(
          id,
          living(b, "enemy").sort((a, c) => a.hp - c.hp)[0]?.id,
        );
        if (!a.error) {
          launch(a);
          return;
        }
      }
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
      const action = basicAction(b, actor);
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
      if (state.anim && !state.anim.applied) applyAction(b, state.anim.action);
      state.anim = null;
      state.pending = null;
      cancelTarget();
      let steps = 0;
      while (!b.outcome && steps++ < 1500) {
        if (state.auto) {
          const id = chooseAuto();
          if (id) {
            const a = command(id, living(b, "enemy")[0]?.id);
            if (!a.error) {
              applyAction(b, a);
              continue;
            }
          }
        }
        const actor = nextActor(b);
        if (actor) {
          const a = basicAction(b, actor);
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
      save.gold += result.gold;
      save.xp += result.xp;
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
      `<section class="result-screen ${r.victory ? "" : "result-defeat"}"><div class="result-band"></div><img class="result-portrait" src="${ART.victory.src}" alt="霜火枪姬胜利立绘"><div class="result-title">${r.victory ? "大获全胜" : "战斗失利"}</div><div class="result-stars">${r.victory ? "★".repeat(r.stars) + `<span class="dim">${"★".repeat(2 - r.stars)}</span>` : ""}</div>${r.victory ? `<div class="reward-line"><div><i class="exp">EXP</i><span id="rewardXp" class="reward-box">+${r.xp}</span></div><div><i class="coin">◉</i><span id="rewardGold" class="reward-box">+${r.gold}</span></div></div><div class="xp-bar"><i style="width:${((save.xp % 62) / 62) * 100}%"></i><span>经验　${save.xp % 62}/62</span></div><div class="chest-prompt">${r.claimed ? "奖励已领取" : "请选择一个宝箱，抽取您的奖励"}</div><div class="chest-row">${[0, 1, 2].map((i) => `<button class="chest-button ${r.choice === i ? "selected" : ""}" data-chest="${i}" ${r.claimed ? "disabled" : ""} aria-label="选择第${i + 1}个宝箱"><span class="rune"></span><img src="${r.choice === i ? openChest : closedChest}" alt="${r.choice === i ? "已打开宝箱" : "宝箱"}">${r.choice === i ? `<span class="reward-label">${r.rewardText}</span>` : ""}</button>`).join("")}</div><div class="result-actions" ${r.claimed ? "" : "hidden"}><button class="ornate blue" id="resultMap">退出</button><button class="ornate gold" id="nextStage">${state.stage < 2 ? "下一关" : "再挑战"}</button></div>${confetti()}` : `<div class="chest-prompt">${state.battle.round > 30 ? "战斗超过 30 回合。" : "英雄暂时倒下了。"}<br>调整前排位置，或让「风之女」加入队伍提供治疗。</div><div class="result-actions"><button class="ornate blue" id="retryFormation">调整阵型</button><button class="ornate gold" id="retry">再次挑战</button></div>`}</section>`,
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
          const next = Math.min(2, state.stage + 1);
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
    if (r.claimed && up && !r.levelShown) {
      r.levelShown = true;
      const level = document.createElement("div");
      level.className = "level-popup";
      level.innerHTML = `<div class="level-halo"></div><h2>LEVEL UP</h2><img src="${portraits.get("blade")}" alt="英雄升级"><strong>Lv.${levelFor(save.xp)}</strong><p>英雄生命和攻击成长</p><button class="ornate gold" id="levelConfirm">确定</button>`;
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
  $("#skillBar").onclick = (e) => {
    const button = e.target.closest("[data-spell]");
    if (button && !button.disabled) selectSpell(button.dataset.spell);
  };
  listen(window, "keydown", (e) => {
    if (activeModal) {
      if (e.key === "Escape" && !["result"].includes(activeModal)) {
        e.preventDefault();
        if (activeModal === "pause") state.paused = false;
        closeModal();
      }
      if (e.key === "Tab") {
        const buttons = [
          ...$("#overlayContent").querySelectorAll("button:not(:disabled)"),
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
    if (e.key === "Escape") cancelTarget();
    if (state.mode === "battle") {
      if (e.code === "Space") {
        e.preventDefault();
        togglePause();
      }
      if (/^[123]$/.test(e.key)) selectSpell(SPELLS[Number(e.key) - 1].id);
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
    if (document.hidden) {
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
      root.querySelectorAll("button").forEach((b) => (b.onclick = null));
      closeModal();
    },
  };
}
