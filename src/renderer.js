import { ART, drawSprite } from "./art.js";
import { HEROES, ENEMIES, STAGES, getHero } from "./data.js";
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
};
function arrow(c, x, y, color, enemy = false, selected = false) {
  c.save();
  c.translate(x, y);
  if (enemy) c.scale(-0.68, 0.68);
  c.shadowColor = color;
  c.shadowBlur = selected ? 12 : 4;
  c.lineWidth = 2.4;
  c.strokeStyle = color;
  c.fillStyle = color + "25";
  const shape = (s) => {
    c.beginPath();
    c.moveTo(-57 * s, 16 * s);
    c.lineTo(9 * s, 16 * s);
    c.lineTo(4 * s, 24 * s);
    c.lineTo(67 * s, 0);
    c.lineTo(34 * s, -24 * s);
    c.lineTo(30 * s, -16 * s);
    c.lineTo(-35 * s, -16 * s);
    c.closePath();
    c.fill();
    c.stroke();
  };
  shape(1);
  c.shadowBlur = 0;
  shape(0.79);
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(-32 + i * 10, -9);
    c.lineTo(-27 + i * 10, 0);
    c.lineTo(-39 + i * 10, 9);
    c.stroke();
  }
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
    c.drawImage(ART.background, 0, 0, W, H);
    this.hits = [];
    const prep = state.mode === "formation";
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
      (a, b) => position(a.side, a.slot).y - position(b.side, b.slot).y,
    )) {
      const origin = position(u.side, u.slot),
        height = heights[u.kind] || 125;
      let { x, y } = origin,
        dead = u.hp <= 0;
      if (state.drag?.active && state.drag.id === u.id) continue;
      if (anim && anim.action.actor === u.id && anim.action.kind === "attack") {
        const target = state.battle.units.find(
            (t) => t.id === anim.action.targets[0].id,
          ),
          to = position(target.side, target.slot);
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
        c.translate(x, y);
        c.rotate(u.side === "enemy" ? -0.9 : 0.9);
        c.translate(-x, -y);
      }
      c.fillStyle = "#251b1544";
      c.beginPath();
      c.ellipse(x, y - 1, 32, 8, 0, 0, 7);
      c.fill();
      if (prep && state.selected === u.id) {
        c.strokeStyle = "#fff3b7aa";
        c.lineWidth = 1.5;
        c.beginPath();
        c.ellipse(x, y, 35, 8, 0, 0, 7);
        c.stroke();
      }
      const flip =
        (u.sprite === 5 && u.side === "enemy") ||
        u.sprite === 6 ||
        u.sprite === 7
          ? false
          : false;
      drawSprite(
        c,
        u.sprite,
        x,
        y + (dead ? 9 : Math.sin(now * 0.003 + u.slot) * 1),
        height,
        flip,
      );
      c.restore();
      if (!prep && !dead) {
        const barY = y + 10;
        this.text(u.name, x, barY - 1, u.color, 15);
        c.fillStyle = "#222522";
        c.fillRect(x - 39, barY + 5, 78, 10);
        c.strokeStyle = "#c8bdaa";
        c.lineWidth = 1;
        c.strokeRect(x - 39, barY + 5, 78, 10);
        const g = c.createLinearGradient(0, barY + 5, 0, barY + 15);
        g.addColorStop(0, u.side === "ally" ? "#f35663" : "#ec7173");
        g.addColorStop(0.5, "#b80012");
        g.addColorStop(1, "#690d16");
        c.fillStyle = g;
        c.fillRect(x - 37, barY + 7, 74 * Math.max(0, u.hp / u.maxHp), 6);
        c.fillStyle = "#222";
        c.strokeStyle = "#bdb3a1";
        c.beginPath();
        c.ellipse(x - 44, barY + 9, 12, 14, 0, 0, 7);
        c.fill();
        c.stroke();
        this.text(
          String(u.side === "ally" ? state.level || 6 : u.level || 2),
          x - 44,
          barY + 14,
          "#fff",
          12,
        );
      }
      if (state.targeting && u.side === "enemy" && !dead) {
        c.strokeStyle = "#ffde5f";
        c.lineWidth = 3;
        c.beginPath();
        c.arc(x, y - height / 2, 35 + Math.sin(now * 0.008) * 3, 0, 7);
        c.stroke();
        this.text("▼", x, y - height - 8, "#fff18e", 20);
      }
      this.hits.push({
        id: u.id,
        unit: u,
        x: origin.x,
        y: origin.y,
        h: height,
        w: u.kind === "wolf" ? 95 : 86,
      });
    }
    if (anim) this.effect(anim.action, p, state.battle, now);
    this.floats = this.floats.filter((f) => now - f.start < 1250);
    for (const f of this.floats) {
      const u = units.find((u) => u.id === f.id);
      if (!u) continue;
      const pos = position(u.side, u.slot),
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
      c.fillStyle = "#10151ad9";
      c.fillRect(0, 0, W, H);
      drawSprite(c, 1, 410, 430, 300);
      drawSprite(c, 4, 665, 430, 300);
      this.text("战 斗 准 备", 512, 140, "#fbd97f", 35);
      c.fillStyle = "#1d2630";
      c.fillRect(240, 490, 544, 12);
      c.fillStyle = "#c69e44";
      c.fillRect(242, 492, 540 * Math.min(1, state.loading / 850), 8);
      this.text("正在进入战场，请稍候…", 512, 530, "#e7dba7", 14);
    }
  }
  effect(action, p, b, now) {
    const c = this.ctx,
      actor = b.units.find((u) => u.id === action.actor),
      from = position(actor.side, actor.slot);
    if (p < 0.12 || p > 0.95) return;
    if (action.kind === "nova" && p < 0.4) {
      c.save();
      c.globalAlpha = Math.sin((p / 0.4) * Math.PI) * 0.93;
      c.fillStyle = "#050b16aa";
      c.fillRect(0, 120, W, 270);
      c.drawImage(ART.victory, 40, -70, 285, 428);
      this.text("弹 幕 风 暴", 540, 250, "#ffdf60", 40);
      c.restore();
    }
    for (const hit of action.targets) {
      const u = b.units.find((u) => u.id === hit.id),
        to = position(u.side, u.slot);
      const t = Math.max(0, Math.min(1, (p - 0.18) / 0.42));
      if (action.kind === "bolt") {
        const x = from.x + (to.x - from.x) * t,
          y = from.y - 55 + (to.y - from.y) * t;
        c.save();
        c.globalCompositeOperation = "lighter";
        c.shadowColor = "#ffae2c";
        c.shadowBlur = 16;
        c.strokeStyle = actor.kind === "ranger" ? "#c3ff82" : "#ffc860";
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(x - 26, y + 3);
        c.lineTo(x, y);
        c.stroke();
        c.fillStyle = "#fff3c1";
        c.beginPath();
        c.arc(x, y, 6, 0, 7);
        c.fill();
        c.restore();
      }
      if (action.kind === "comet" && p > 0.23) {
        c.save();
        c.translate(to.x, to.y - 45);
        c.rotate(-0.6);
        c.globalCompositeOperation = "lighter";
        c.globalAlpha = Math.sin(p * Math.PI);
        c.shadowColor = "#fc451d";
        c.shadowBlur = 25;
        c.fillStyle = "#ffe3a3";
        c.beginPath();
        c.moveTo(-13, -125);
        c.lineTo(14, -125);
        c.lineTo(8, 45);
        c.lineTo(0, 75);
        c.lineTo(-9, 45);
        c.closePath();
        c.fill();
        c.strokeStyle = "#ff5837";
        c.lineWidth = 12;
        c.beginPath();
        c.arc(0, 0, 70, -2, 1.7);
        c.stroke();
        c.restore();
      }
      if (action.kind === "nova" && p > 0.3) {
        c.save();
        c.globalCompositeOperation = "lighter";
        c.strokeStyle = "#ff4e22";
        c.shadowColor = "#ff4a1d";
        c.shadowBlur = 18;
        c.lineWidth = 5;
        for (let i = 0; i < 5; i++) {
          const slide = (p * 3 + i * 0.21) % 1;
          c.beginPath();
          c.moveTo(
            to.x - 170 * (1 - slide),
            to.y - 170 * (1 - slide) - 30 + i * 5,
          );
          c.lineTo(
            to.x - 80 * (1 - slide),
            to.y - 70 * (1 - slide) - 25 + i * 5,
          );
          c.stroke();
        }
        c.restore();
      }
      if ((action.kind === "spring" || action.kind === "heal") && p > 0.2) {
        c.save();
        c.globalCompositeOperation = "lighter";
        c.strokeStyle = "#fff030";
        c.shadowColor = "#ffdb00";
        c.shadowBlur = 18;
        c.lineWidth = 3;
        for (let j = 0; j < 3; j++) {
          c.beginPath();
          c.ellipse(
            to.x,
            to.y - 50,
            45 + j * 8,
            65 + j * 8,
            now * 0.001 + j,
            0,
            7,
          );
          c.stroke();
        }
        this.text("+", to.x, to.y - 60, "#e8ff64", 45);
        c.restore();
      }
      if (p > 0.45 && !hit.heal) {
        c.save();
        c.globalCompositeOperation = "lighter";
        c.globalAlpha = Math.max(0, 1 - (p - 0.45) / 0.5);
        const radius = 15 + (p - 0.45) * 140;
        const gradient = c.createRadialGradient(
          to.x,
          to.y - 48,
          0,
          to.x,
          to.y - 48,
          radius,
        );
        gradient.addColorStop(0, "#fffff7");
        gradient.addColorStop(0.2, "#ffe982");
        gradient.addColorStop(1, "#ff600000");
        c.fillStyle = gradient;
        c.fillRect(to.x - radius, to.y - 48 - radius, radius * 2, radius * 2);
        c.strokeStyle = "#fff0a0";
        c.lineWidth = 4;
        for (let i = 0; i < 7; i++) {
          const a = i * 0.897;
          c.beginPath();
          c.moveTo(
            to.x + Math.cos(a) * radius * 0.4,
            to.y - 48 + Math.sin(a) * radius * 0.4,
          );
          c.lineTo(
            to.x + Math.cos(a) * radius,
            to.y - 48 + Math.sin(a) * radius,
          );
          c.stroke();
        }
        c.restore();
      }
    }
  }
}
