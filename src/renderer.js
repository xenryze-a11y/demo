import { drawNativeEffect, nativeDuration } from "./native-rig.js?v=e7b6ee51ab02";
import { ART, drawSprite } from "./art.js?v=e7b6ee51ab02";
import { HEROES, ENEMIES, STAGES, getHero, SPELLS } from "./data.js?v=e7b6ee51ab02";
export const W = 1024,
  H = 576;
export function position(side, slot) {
  const row = Math.floor(slot / 3),
    col = slot % 3;
  return side === "ally"
    ? { x: 170 + col * 140 - row * 50, y: 251 + row * 82 }
    : { x: 650 + col * 93 + row * 37, y: 242 + row * 57 };
}
const heights = {
  guard: 137,
  knight: 146,
  ranger: 115,
  rogue: 112,
  gunner: 128,
  healer: 128,
  wolf: 77,
  sentinel: 163,
  boss: 195,
};
// Measured separately in the 8.5 s formation and 18 s combat reference frames.
export function battlePosition(side, slot) {
  const row = Math.floor(slot / 3),
    col = slot % 3;
  return side === "ally"
    ? { x: 160 + col * 140 - row * 50, y: 230 + row * 100 }
    : { x: 640 + col * 130 + row * 50, y: 230 + row * 100 };
}
export function actionPosition(battle, action, progress) {
  const actor = battle.units.find((u) => u.id === action.actor);
  if (!actor) return { x: 0, y: 0 };
  const origin = battlePosition(actor.side, actor.slot);
  if (action.movement !== "advance-spin") return origin;
  const targets = action.targets
    .map((h) => battle.units.find((u) => u.id === h.id))
    .filter(Boolean);
  const direction = actor.side === "ally" ? 1 : -1;
  const nearest = targets.length
    ? Math.min(
        ...targets.map((u) =>
          Math.abs(battlePosition(u.side, u.slot).x - origin.x),
        ),
      )
    : 250;
  const distance = Math.max(0, Math.min(180, nearest - 70));
  const phase =
    progress < 0.18
      ? progress / 0.18
      : progress > 0.82
        ? (1 - progress) / 0.18
        : 1;
  const t = Math.max(0, Math.min(1, phase));
  const eased = t * t * (3 - 2 * t);
  return { x: origin.x + direction * distance * eased, y: origin.y };
}
function arrow(c, x, y, color, enemy = false, selected = false) {
  const key = ["#f5f4e8", "#f0c769", "#c7d9ff"].includes(color)
    ? "arrowWhite"
    : /f[026]6|f268/.test(color)
      ? "arrowPurple"
      : /7af|7ef/.test(color)
        ? "arrowGreen"
        : "arrowBlue";
  const image = ART[key];
  c.save();
  c.translate(x, y);
  if (enemy) c.scale(-0.68, 0.68);
  if (selected) {
    c.shadowColor = "#ffed80";
    c.shadowBlur = 12;
  }
  c.drawImage(image, -67, -25, 134, 50);
  c.restore();
}
export class Battlefield {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext("2d");
    this.hits = [];
    this.floats = [];
    this.flash = 0;
  }
  point(event) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - r.left) / r.width) * W,
      y: ((event.clientY - r.top) / r.height) * H,
    };
  }
  hit(p) {
    return [...this.hits]
      .reverse()
      .find(
        (h) =>
          p.x > h.x - h.w / 2 &&
          p.x < h.x + h.w / 2 &&
          p.y > h.y - h.h &&
          p.y < h.y + 10,
      );
  }
  slotAt(p) {
    let best = null,
      d = 60;
    for (let i = 0; i < 9; i++) {
      const s = position("ally", i),
        distance = Math.hypot((p.x - s.x) * 0.7, p.y - s.y);
      if (distance < d) {
        best = i;
        d = distance;
      }
    }
    return best;
  }
  text(text, x, y, color = "#fff", size = 16, align = "center") {
    const c = this.ctx;
    c.save();
    c.font = `bold ${size}px "Microsoft YaHei",sans-serif`;
    c.textAlign = align;
    c.lineJoin = "round";
    c.lineWidth = 3;
    c.strokeStyle = "#1b151a";
    c.strokeText(text, x, y);
    c.fillStyle = color;
    c.fillText(text, x, y);
    c.restore();
  }
  float(text, id, color) {
    this.floats.push({ text, id, color, start: performance.now() });
  }
  render(state, now) {
    const c = this.ctx;
    c.clearRect(0, 0, W, H);
    c.drawImage(
      state.stage === 3 ? ART.bossBackground : ART.background,
      0,
      0,
      W,
      H,
    );
    this.hits = [];
    const prep = state.mode === "formation";
    const locate = prep ? position : battlePosition;
    const units = prep
      ? [
          ...state.formation.flatMap((id, slot) =>
            id
              ? [
                  {
                    ...getHero(id),
                    id,
                    side: "ally",
                    slot,
                    maxHp: getHero(id).hp,
                  },
                ]
              : [],
          ),
          ...STAGES[state.stage].enemies.map(([type, slot], i) => ({
            ...ENEMIES[type],
            id: `enemy-${i}`,
            side: "enemy",
            slot,
            maxHp: ENEMIES[type].hp,
          })),
        ]
      : state.battle?.units || [];
    if (prep) {
      for (const side of ["ally", "enemy"])
        for (let i = 0; i < 9; i++) {
          const p = position(side, i),
            hero =
              side === "ally"
                ? getHero(state.formation[i])
                : units.find((u) => u.side === side && u.slot === i),
            color =
              state.drag?.slot === i && side === "ally"
                ? "#ffee91"
                : hero?.color || "#f5f4e8";
          arrow(
            c,
            p.x,
            p.y,
            color,
            side === "enemy",
            side === "ally" && state.drag?.slot === i,
          );
        }
    }
    const anim = state.anim,
      p = anim ? Math.min(1, anim.elapsed / anim.duration) : 0;
    if (
      anim &&
      !["attack", "bolt", "heal"].includes(anim.action.kind) &&
      p < 0.3
    ) {
      c.fillStyle = `rgba(0,0,0,${Math.sin((p / 0.3) * Math.PI) * 0.3})`;
      c.fillRect(0, 0, W, H);
    }
    for (const u of [...units].sort(
      (a, b) =>
        locate(a.side, a.slot).y - locate(b.side, b.slot).y ||
        Number(a.id === anim?.action.actor) -
          Number(b.id === anim?.action.actor),
    )) {
      const origin = locate(u.side, u.slot),
        height =
          (heights[u.kind] || 125) *
          (prep
            ? u.side === "enemy"
              ? 0.65
              : u.kind === "rogue"
                ? 0.78
                : 0.84
            : 1);
      let { x, y } = origin,
        dead = u.hp <= 0;
      if (state.drag?.active && state.drag.id === u.id) continue;
      const spinning =
        anim?.action.actor === u.id && anim.action.movement === "advance-spin";
      if (spinning) ({ x, y } = actionPosition(state.battle, anim.action, p));
      if (anim && anim.action.actor === u.id && anim.action.kind === "attack") {
        const target = state.battle.units.find(
            (t) => t.id === anim.action.targets[0].id,
          ),
          to = locate(target.side, target.slot);
        const dash = p < 0.27 ? p / 0.27 : p > 0.7 ? (1 - p) / 0.3 : 1;
        x +=
          (to.x - origin.x + (u.side === "ally" ? -60 : 60)) *
          Math.max(0, dash);
        y += (to.y - origin.y) * Math.max(0, dash);
      }
      if (
        anim &&
        anim.action.targets.some((t) => t.id === u.id) &&
        p > 0.48 &&
        p < 0.7 &&
        !anim.action.targets[0].heal
      )
        x += Math.sin(p * 90) * 5;
      c.save();
      if (dead) {
        c.globalAlpha = 0.25;
      }
      c.drawImage(ART.shadow, x - 33, y - 11, 66, 24);
      if (prep && state.selected === u.id) {
        c.strokeStyle = "#fff3b7aa";
        c.lineWidth = 1.5;
        c.beginPath();
        c.ellipse(x, y, 35, 8, 0, 0, 7);
        c.stroke();
      }
      const flip = (u.side === "enemy") !== (spinning && p > 0.82);
      const acting = anim?.action.actor === u.id;
      const struck =
        anim?.action.targets.some((hit) => hit.id === u.id && !hit.heal) &&
        p > 0.5 &&
        p < 0.8;
      const motion = spinning
        ? p < 0.18 || p > 0.82
          ? "run"
          : "skill1_loop"
        : dead
          ? "dead"
          : acting
            ? anim.action.animation ||
              (["attack", "bolt"].includes(anim.action.kind)
                ? "attack"
                : "skill1")
            : struck
              ? "hurt"
              : "stand";
      const motionTime = spinning
        ? p < 0.18
          ? anim.elapsed / 1000
          : (anim.elapsed - anim.duration * 0.18) / 1000
        : acting
          ? (Math.max(0, p - (anim.action.kind === "attack" ? 0.23 : 0)) /
              (anim.action.kind === "attack" ? 0.5 : 0.92)) *
            nativeDuration(u.sprite, motion)
          : dead
            ? 2
            : struck
              ? (p - 0.5) * 0.4
              : now / 1000 + u.slot * 0.17;
      drawSprite(
        c,
        u.sprite,
        x,
        y + (dead ? 9 : Math.sin(now * 0.003 + u.slot) * 1),
        height,
        flip,
        1,
        motion,
        motionTime,
        spinning || (!dead && !acting && !struck),
      );
      c.restore();
      if (!prep && !dead) {
        const barY = y + 5,
          ratio = Math.max(0, u.hp / u.maxHp);
        this.text(u.name, x, barY - 1, u.color, 16);
        c.drawImage(ART.hpFrame, x - 56, barY, 95, 31);
        if (ratio > 0)
          c.drawImage(
            ART.hpFill,
            0,
            0,
            ART.hpFill.width * ratio,
            ART.hpFill.height,
            x - 25,
            barY + 11,
            61 * ratio,
            9,
          );
        this.text(String(u.level || 2), x - 41, barY + 23, "#fff", 14);
      }
      if (state.targeting && u.side === "enemy" && !dead) {
        c.strokeStyle = "#ffde5f";
        c.lineWidth = 3;
        c.beginPath();
        c.arc(x, y - height / 2, 35 + Math.sin(now * 0.008) * 3, 0, 7);
        c.stroke();
        this.text("▼", x, y - height - 8, "#fff18e", 20);
      }
      if (!prep && !dead && (u.shield || u.reflect))
        drawNativeEffect(
          c,
          u.shield ? "skill20101_add" : "skill20301_add",
          x,
          y,
          125,
          now / 1000,
          true,
        );
      const status = [
        u.shield > 0 ? "护盾" : "",
        u.reflect ? "反伤" : "",
        u.stun ? "冰封" : "",
        u.poison ? "剧毒" : "",
        u.silence ? "沉默" : "",
      ]
        .filter(Boolean)
        .join(" ");
      if (!prep && status && !dead) this.text(status, x, y + 38, "#b4eaff", 12);
      this.hits.push({
        id: u.id,
        unit: u,
        x: origin.x,
        y: origin.y,
        h: height,
        w: u.kind === "wolf" ? 95 : 86,
      });
    }
    if (state.stage === 3) {
      const boss = units.find((unit) => unit.kind === "boss");
      if (boss) {
        const ratio = Math.max(0, boss.hp / boss.maxHp);
        c.fillStyle = "#15151de6";
        c.fillRect(580, 77, 385, 38);
        c.strokeStyle = "#b79a5a";
        c.strokeRect(580, 77, 385, 38);
        c.fillStyle = "#501121";
        c.fillRect(588, 98, 369, 10);
        c.fillStyle = "#cf263a";
        c.fillRect(588, 98, 369 * ratio, 10);
        this.text("BOSS  狂暴狼王", 590, 92, "#ffdf8d", 15, "left");
        this.text(
          `${Math.ceil(boss.hp)} / ${boss.maxHp}`,
          951,
          92,
          "#fff",
          12,
          "right",
        );
      }
    }
    if (anim) this.effect(anim.action, p, state.battle, now);
    this.floats = this.floats.filter((f) => now - f.start < 1250);
    for (const f of this.floats) {
      const u = units.find((u) => u.id === f.id);
      if (!u) continue;
      const pos = locate(u.side, u.slot),
        t = (now - f.start) / 1250;
      c.globalAlpha = 1 - Math.max(0, (t - 0.65) / 0.35);
      this.text(f.text, pos.x, pos.y - 75 - t * 48, f.color, 27);
      c.globalAlpha = 1;
    }
    if (state.drag?.active) {
      const h = getHero(state.drag.id);
      drawSprite(
        c,
        h.sprite,
        state.drag.x,
        state.drag.y,
        heights[h.kind],
        false,
        0.85,
      );
    }
    if (state.mode === "loading") {
      c.drawImage(ART.loadingScene, 0, 0, W, H);
      c.fillStyle = "#1d2630";
      c.fillRect(240, 490, 544, 12);
      c.fillStyle = "#c69e44";
      c.fillRect(242, 492, 540 * Math.min(1, state.loading / 850), 8);
      this.text("正在进入战场，请稍候…", 512, 530, "#e7dba7", 14);
    }
  }
  effect(action, p, b, now) {
    const c = this.ctx,
      actor = b.units.find((u) => u.id === action.actor);
    if (!actor) return;
    const from = actionPosition(b, action, p),
      spell = SPELLS.find((s) => s.id === action.kind);
    if (p < 0.12 || p > 0.97) return;
    if (!["attack", "bolt", "heal"].includes(action.kind) && p < 0.52) {
      const title = spell && ART["skillTitle" + spell.nativeId];
      if (title) c.drawImage(title, from.x - 90, from.y - 175, 180, 45);
      else this.text(action.name, from.x, from.y - 150, "#ffe38d", 20);
    }
    if (action.kind === "lotus" && p >= 0.18 && p <= 0.82)
      drawNativeEffect(
        c,
        "skill22901_self",
        from.x,
        from.y + 10,
        150,
        p * 1.35,
        true,
      );
    const hitsPerTarget = action.multi
      ? Math.max(
          1,
          ...action.targets.map(
            (h) => action.targets.filter((t) => t.id === h.id).length,
          ),
        )
      : 1;
    for (const hit of [
      ...new Map(action.targets.map((h) => [h.id, h])).values(),
    ]) {
      const unit = b.units.find((u) => u.id === hit.id);
      if (!unit) continue;
      const to = battlePosition(unit.side, unit.slot);
      const phase = action.multi
        ? (((p - 0.28) / 0.55) * hitsPerTarget) % 1
        : (p - 0.22) / 0.3;
      if (
        (action.kind === "bolt" || (spell && actor.kind !== "knight")) &&
        !hit.heal &&
        !hit.shield &&
        phase >= 0 &&
        phase < 1
      ) {
        const xx = from.x + (to.x - from.x) * phase,
          yy = from.y - 65 + (to.y - from.y) * phase;
        c.save();
        c.translate(xx, yy);
        c.rotate(Math.atan2(to.y - from.y, to.x - from.x));
        c.shadowColor = actor.kind === "ranger" ? "#ffdf4a" : "#ff8338";
        c.shadowBlur = 9;
        c.strokeStyle = "#fff7b7";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(-38, 0);
        c.lineTo(9, 0);
        c.stroke();
        c.fillStyle = "#ffde5b";
        c.beginPath();
        c.moveTo(13, 0);
        c.lineTo(2, -5);
        c.lineTo(2, 5);
        c.fill();
        c.restore();
      }
      if (hit.shield || hit.reflect) {
        drawNativeEffect(
          c,
          hit.shield ? "skill20101_add" : "skill20301_add",
          to.x,
          to.y,
          135,
          p * 1.2,
          false,
        );
        continue;
      }
      if (action.kind === "lotus" && p >= 0.28 && p <= 0.82)
        drawNativeEffect(
          c,
          "skill22901_front_loop",
          to.x,
          to.y,
          160,
          p * 1.35,
          true,
        );
      if (hit.heal) {
        c.save();
        c.globalAlpha = Math.sin(p * Math.PI);
        this.text("+", to.x, to.y - 65, "#b2ff56", 34);
        c.restore();
        continue;
      }
      const impact = action.multi ? phase : (p - 0.48) * 2.3;
      if (impact >= 0 && impact < 0.8)
        drawNativeEffect(
          c,
          "zhandou_shouji",
          to.x,
          to.y + 5,
          150,
          impact,
          false,
        );
      if (action.kind === "bossSlam" && p > 0.3) {
        c.save();
        c.globalAlpha = Math.sin(p * Math.PI);
        c.strokeStyle = "#c9f5ff";
        c.lineWidth = 5;
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.moveTo(to.x - 50 + i * 20, to.y - 140);
          c.lineTo(to.x + 15 + i * 20, to.y);
          c.stroke();
        }
        c.restore();
      }
    }
  }
}
