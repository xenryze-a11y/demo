import { initNativeRigs, drawNativeRig } from "./native-rig.js?v=669213efe941";
import { NATIVE_UI_URLS } from "./native-ui.js?v=669213efe941";
const urls = {
  ...NATIVE_UI_URLS,
  map: new URL("../assets/map.png", import.meta.url).href,
  sprites: new URL("../assets/heroes.png", import.meta.url).href,
  victory: NATIVE_UI_URLS.victory,
  chests: new URL("../assets/chests.png", import.meta.url).href,
  rig0_0: new URL("../assets/native/rig0_0.png", import.meta.url).href,
  card0: new URL("../assets/native/card0.jpg", import.meta.url).href,
  head0: new URL("../assets/native/head0.jpg", import.meta.url).href,
  rig1_0: new URL("../assets/native/rig1_0.png", import.meta.url).href,
  rig1_1: new URL("../assets/native/rig1_1.png", import.meta.url).href,
  card1: new URL("../assets/native/card1.jpg", import.meta.url).href,
  head1: new URL("../assets/native/head1.jpg", import.meta.url).href,
  rig2_0: new URL("../assets/native/rig2_0.png", import.meta.url).href,
  card2: new URL("../assets/native/card2.jpg", import.meta.url).href,
  head2: new URL("../assets/native/head2.jpg", import.meta.url).href,
  rig3_0: new URL("../assets/native/rig3_0.png", import.meta.url).href,
  card3: new URL("../assets/native/card3.jpg", import.meta.url).href,
  head3: new URL("../assets/native/head3.jpg", import.meta.url).href,
  rig4_0: new URL("../assets/native/rig4_0.png", import.meta.url).href,
  card4: new URL("../assets/native/card4.jpg", import.meta.url).href,
  head4: new URL("../assets/native/head4.jpg", import.meta.url).href,
  rig5_0: new URL("../assets/native/rig5_0.png", import.meta.url).href,
  card5: new URL("../assets/native/card5.jpg", import.meta.url).href,
  head5: new URL("../assets/native/head5.jpg", import.meta.url).href,
  rig6_0: new URL("../assets/native/rig6_0.png", import.meta.url).href,
  rig7_0: new URL("../assets/native/rig7_0.png", import.meta.url).href,
  background: new URL("../assets/native/background.jpg", import.meta.url).href,
  bossBackground: new URL(
    "../assets/native/bossBackground.jpg",
    import.meta.url,
  ).href,
  bossHead: new URL("../assets/native/bossHead.jpg", import.meta.url).href,
  skillSword: new URL("../assets/native/skillSword.jpg", import.meta.url).href,
  skillFire: new URL("../assets/native/skillFire.jpg", import.meta.url).href,
  skillSun: new URL("../assets/native/skillSun.jpg", import.meta.url).href,
  buttonBlue: new URL("../assets/native/buttonBlue.png", import.meta.url).href,
  buttonGold: new URL("../assets/native/buttonGold.png", import.meta.url).href,
  rig2_1: new URL("../assets/native/rig2_1.png", import.meta.url).href,
  rig2_2: new URL("../assets/native/rig2_2.png", import.meta.url).href,
  rig8_0: new URL("../assets/native/rig8_0.png", import.meta.url).href,
  rig8_1: new URL("../assets/native/rig8_1.png", import.meta.url).href,
  card8: new URL("../assets/native/card8.jpg", import.meta.url).href,
  head8: new URL("../assets/native/head8.jpg", import.meta.url).href,
  rig9_0: new URL("../assets/native/rig9_0.png", import.meta.url).href,
  rig9_1: new URL("../assets/native/rig9_1.png", import.meta.url).href,
  card9: new URL("../assets/native/card9.jpg", import.meta.url).href,
  head9: new URL("../assets/native/head9.jpg", import.meta.url).href,
  skill12001: new URL("../assets/native/skill12001.jpg", import.meta.url).href,
  skill12011: new URL("../assets/native/skill12011.jpg", import.meta.url).href,
  skill12041: new URL("../assets/native/skill12041.jpg", import.meta.url).href,
  skill12051: new URL("../assets/native/skill12051.jpg", import.meta.url).href,
  skill12081: new URL("../assets/native/skill12081.jpg", import.meta.url).href,
  skill12091: new URL("../assets/native/skill12091.jpg", import.meta.url).href,
  skill11001: new URL("../assets/native/skill11001.jpg", import.meta.url).href,
  skill11011: new URL("../assets/native/skill11011.jpg", import.meta.url).href,
  skill11041: new URL("../assets/native/skill11041.jpg", import.meta.url).href,
  skill11021: new URL("../assets/native/skill11021.jpg", import.meta.url).href,
  skill11081: new URL("../assets/native/skill11081.jpg", import.meta.url).href,
  skill11091: new URL("../assets/native/skill11091.jpg", import.meta.url).href,
  skill13001: new URL("../assets/native/skill13001.jpg", import.meta.url).href,
  skill13011: new URL("../assets/native/skill13011.jpg", import.meta.url).href,
  skill13041: new URL("../assets/native/skill13041.jpg", import.meta.url).href,
  skill13021: new URL("../assets/native/skill13021.jpg", import.meta.url).href,
  skill13081: new URL("../assets/native/skill13081.jpg", import.meta.url).href,
  skill13091: new URL("../assets/native/skill13091.jpg", import.meta.url).href,
};

export const ART = {};
function load(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => {
      image.onload = image.onerror = null;
      image.src = "";
      reject(new Error("美术资源加载超时"));
    }, 60000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error("无法加载美术资源"));
    };
    image.src = url;
  });
}
export async function loadArt(onProgress = () => {}) {
  let completed = 0;
  const total = Object.keys(urls).length;
  onProgress(completed, total);
  await Promise.all(
    Object.entries(urls).map(async ([name, url]) => {
      ART[name] = await load(url);
      onProgress(++completed, total);
    }),
  );
  initNativeRigs(ART);
  ART.bounds = cellBounds(ART.sprites, 4, 2);
  ART.chestBounds = cellBounds(ART.chests, 2, 1);
  return ART;
}
function cellBounds(image, cols, rows) {
  const cv = document.createElement("canvas");
  cv.width = image.width;
  cv.height = image.height;
  const c = cv.getContext("2d", { willReadFrequently: true });
  c.drawImage(image, 0, 0);
  const data = c.getImageData(0, 0, cv.width, cv.height).data,
    out = [];
  for (let n = 0; n < cols * rows; n++) {
    const x0 = Math.floor(((n % cols) * cv.width) / cols),
      y0 = Math.floor((Math.floor(n / cols) * cv.height) / rows),
      x1 = Math.floor((((n % cols) + 1) * cv.width) / cols),
      y1 = Math.floor(((Math.floor(n / cols) + 1) * cv.height) / rows);
    let minX = x1,
      minY = y1,
      maxX = x0,
      maxY = y0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        if (data[(y * cv.width + x) * 4 + 3] > 40) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
    out.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
  }
  return out;
}
export function drawSprite(
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
  if (
    drawNativeRig(c, index, x, y, height, flip, alpha, animation, seconds, loop)
  )
    return;
  const b = ART.bounds[index];
  if (!b) return;
  const w = (height * b.w) / b.h;
  c.save();
  c.globalAlpha *= alpha;
  c.translate(x, y);
  if (flip) c.scale(-1, 1);
  c.drawImage(ART.sprites, b.x, b.y, b.w, b.h, -w / 2, -height, w, height);
  c.restore();
}
export function portrait(index) {
  if (ART["head" + index]) return ART["head" + index].src;
  const cv = document.createElement("canvas");
  cv.width = 160;
  cv.height = 160;
  const c = cv.getContext("2d");
  const b = ART.bounds[index];
  const size = Math.max(b.w, b.h);
  c.drawImage(
    ART.sprites,
    b.x,
    b.y,
    b.w,
    b.h,
    80 - (b.w / size) * 75,
    155 - (b.h / size) * 150,
    (b.w / size) * 150,
    (b.h / size) * 150,
  );
  return cv.toDataURL("image/png");
}
export function chestImage(open) {
  if (ART.chestClosed) return ART[open ? "chestOpen" : "chestClosed"].src;
  const b = ART.chestBounds[open ? 1 : 0],
    cv = document.createElement("canvas");
  cv.width = b.w;
  cv.height = b.h;
  cv.getContext("2d").drawImage(ART.chests, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  return cv.toDataURL("image/png");
}
export function iconSvg(kind) {
  if (ART["skill" + kind])
    return `<img src="${ART["skill" + kind].src}" alt="" aria-hidden="true">`;
  const nativeIcon =
    ART[{ sword: "skillSword", fire: "skillFire", sun: "skillSun" }[kind]];
  if (nativeIcon)
    return `<img src="${nativeIcon.src}" alt="" aria-hidden="true">`;
  const common =
    '<defs><radialGradient id="fire"><stop stop-color="#fff7af"/><stop offset=".32" stop-color="#ffb71b"/><stop offset="1" stop-color="#b9000f"/></radialGradient><linearGradient id="steel" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".5" stop-color="#e1e7e4"/><stop offset="1" stop-color="#487082"/></linearGradient></defs>';
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6,
      r = 30,
      x = 32 + Math.cos(a) * r,
      y = 32 + Math.sin(a) * r;
    return `<path d="M32 32L${x} ${y}L${32 + Math.cos(a + 0.12) * 16} ${32 + Math.sin(a + 0.12) * 16}Z" fill="${i % 2 ? "#ffea39" : "#fff1ab"}"/>`;
  }).join("");
  const shapes =
    kind === "sword"
      ? '<path d="M9 58L54 5 49 29 19 55Z" fill="#bf0024" stroke="#fff0a2" stroke-width="2"/><path d="M19 50L53 5 44 30Z" fill="url(#steel)"/><path d="M10 40L29 53M12 53L8 60" stroke="#ffdd62" stroke-width="5"/>'
      : kind === "fire"
        ? '<path d="M14 54Q0 26 39 7Q16 27 30 30Q40 14 55 7Q46 27 59 35Q59 54 29 59" fill="#ffc71f" stroke="#fff0a3"/><path d="M8 57L53 9 42 36 30 32 26 45Z" fill="url(#steel)" stroke="#843100" stroke-width="2"/>'
        : `${rays}<circle cx="32" cy="32" r="11" fill="#db3715" stroke="#ffff97" stroke-width="3"/><path d="M32 22L36 28 43 32 36 35 32 43 28 35 21 32 28 28Z" fill="#fff4b0"/>`;
  return `<svg viewBox="0 0 64 64" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${common}<rect width="64" height="64" fill="#330c10"/><circle cx="32" cy="32" r="36" fill="url(#fire)"/>${shapes}</svg>`;
}
