import { NATIVE_MODELS } from "./native-data.js?v=47d6efce13e9";
import { NATIVE_EFFECTS } from "./native-effects.js?v=47d6efce13e9";
const modelAt = (index) =>
  index >= 100 ? NATIVE_EFFECTS[index - 100] : NATIVE_MODELS[index];
let nativeImages;
const nativeBounds = [];
function nativeMultiply(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function nativeTransform(value) {
  const { x = 0, y = 0, cX = 1, cY = 1, kX = 0, kY = 0 } = value;
  return [
    cX * Math.cos(kY),
    cX * Math.sin(kY),
    cY * Math.sin(kX),
    cY * Math.cos(kX),
    x,
    y,
  ];
}
function nativeSample(frames, time) {
  let a = frames[0],
    b = a;
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].fi <= time) {
      a = frames[i];
      b = frames[i + 1] || a;
    } else break;
  }
  const p =
    a.tweenFrame === false || b.fi === a.fi
      ? 0
      : Math.max(0, Math.min(1, (time - a.fi) / (b.fi - a.fi)));
  const v = { ...a };
  for (const k of ["x", "y", "cX", "cY", "kX", "kY"])
    v[k] =
      (a[k] ?? (k[0] === "c" ? 1 : 0)) +
      ((b[k] ?? (k[0] === "c" ? 1 : 0)) - (a[k] ?? (k[0] === "c" ? 1 : 0))) * p;
  return v;
}
export function nativePose(
  index,
  animation = "stand",
  seconds = 0,
  loop = true,
) {
  const model = modelAt(index);
  if (!model) return [];
  const move =
    model.moves[animation] ||
    (animation.startsWith("skill") ? model.moves.skill1 : null) ||
    model.moves.stand ||
    model.moves["kate_sk1.2"] ||
    Object.values(model.moves)[0];
  const time = loop
    ? (seconds * 30) % Math.max(1, move.dr - 1)
    : Math.min(move.dr - 1, Math.max(0, seconds * 30));
  const tracks = new Map(
    move.mov_bone_data.map((track) => [
      track.name,
      nativeSample(track.frame_data, time),
    ]),
  );
  const bones = new Map(model.bones.map((bone) => [bone.name, bone]));
  const world = new Map();
  const matrix = (bone) => {
    if (world.has(bone.name)) return world.get(bone.name);
    const frame = tracks.get(bone.name) || {};
    let value = nativeTransform({
      x: bone.x + (frame.x || 0),
      y: bone.y + (frame.y || 0),
      cX: bone.cX * (frame.cX ?? 1),
      cY: bone.cY * (frame.cY ?? 1),
      kX: bone.kX + (frame.kX || 0),
      kY: bone.kY + (frame.kY || 0),
    });
    if (bone.parent && bones.has(bone.parent))
      value = nativeMultiply(matrix(bones.get(bone.parent)), value);
    world.set(bone.name, value);
    return value;
  };
  return model.bones
    .flatMap((bone) => {
      const track = tracks.get(bone.name);
      if (!track || track.dI < 0) return [];
      const display = bone.display_data?.[track.dI];
      if (!display || display.displayType !== 0) return [];
      const name = display.name.replace(/\.png$/, "");
      const frame = model.frames[name];
      if (!frame) return [];
      const texture = model.textures[name] || { pX: 0.5, pY: 0.5 };
      const skin = display.skin_data?.[0] || {};
      return [
        {
          matrix: nativeMultiply(matrix(bone), nativeTransform(skin)),
          frame,
          texture,
          z: bone.z + (track.z || 0),
          alpha: (track.color?.a ?? 255) / 255,
          additive: index >= 100 || /^(a_|b_)/.test(bone.name),
        },
      ];
    })
    .sort((a, b) => a.z - b.z);
}
export function initNativeRigs(images) {
  nativeImages = images;
  for (const i of [
    ...NATIVE_MODELS.map((_, i) => i),
    ...NATIVE_EFFECTS.map((_, i) => i + 100),
  ]) {
    let left = Infinity,
      right = -Infinity,
      bottom = Infinity,
      top = -Infinity;
    for (const part of i >= 100
      ? [0.1, 0.3, 0.6].flatMap((t) => nativePose(i, "stand", t, false))
      : nativePose(i)) {
      const f = part.frame,
        t = part.texture,
        m = part.matrix;
      const x =
        -f.originalWidth * t.pX + (f.originalWidth - f.width) / 2 + f.offsetX;
      const y =
        -f.originalHeight * (1 - t.pY) +
        (f.originalHeight - f.height) / 2 -
        f.offsetY;
      for (const [px, py] of [
        [x, -y],
        [x + f.width, -y],
        [x, -y - f.height],
        [x + f.width, -y - f.height],
      ]) {
        const wx = m[0] * px + m[2] * py + m[4],
          wy = m[1] * px + m[3] * py + m[5];
        left = Math.min(left, wx);
        right = Math.max(right, wx);
        bottom = Math.min(bottom, wy);
        top = Math.max(top, wy);
      }
    }
    nativeBounds[i] = {
      center: (left + right) / 2,
      bottom,
      height: Math.max(1, top - bottom),
    };
  }
}
export function drawNativeRig(
  c,
  index,
  x,
  y,
  height,
  flip = false,
  alpha = 1,
  animation = "stand",
  seconds = 0,
  loop = true,
) {
  if (!nativeImages || !nativeBounds[index]) return false;
  const bounds = nativeBounds[index],
    scale = height / bounds.height;
  c.save();
  c.globalAlpha *= alpha;
  c.translate(x, y);
  c.scale(flip ? -scale : scale, -scale);
  c.translate(-bounds.center, -bounds.bottom);
  for (const part of nativePose(index, animation, seconds, loop)) {
    const f = part.frame,
      t = part.texture;
    c.save();
    c.globalAlpha *= part.alpha;
    if (part.additive) c.globalCompositeOperation = "lighter";
    c.transform(...part.matrix);
    c.scale(1, -1);
    c.drawImage(
      nativeImages[f.page],
      f.x,
      f.y,
      f.width,
      f.height,
      -f.originalWidth * t.pX + (f.originalWidth - f.width) / 2 + f.offsetX,
      -f.originalHeight * (1 - t.pY) +
        (f.originalHeight - f.height) / 2 -
        f.offsetY,
      f.width,
      f.height,
    );
    c.restore();
  }
  c.restore();
  return true;
}

export function nativeDuration(index, animation = "attack") {
  const m = modelAt(index);
  const move = m?.moves[animation] || m?.moves.stand;
  return move ? move.dr / 30 : 0.72;
}
export function drawNativeEffect(c, name, x, y, height, seconds, loop = false) {
  const i = NATIVE_EFFECTS.findIndex((m) => m.id === name);
  if (i < 0) return false;
  return drawNativeRig(
    c,
    100 + i,
    x,
    y,
    height,
    false,
    1,
    "stand",
    seconds,
    loop,
  );
}
