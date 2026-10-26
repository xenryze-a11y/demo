import { NATIVE_AUDIO_URLS } from "./native-audio.js?v=8fac583645eb";
import { APK_HERO_CONFIG } from "./apk-config.js?v=8fac583645eb";
export class Sound {
  constructor(enabled = false) {
    this._enabled = enabled;
    this.buffers = new Map();
    this.loading = new Map();
    this.activeSources = new Set();
    this.music = null;
    this.musicPending = false;
    this.scene = "formation";
    this.token = 0;
    this.dead = false;
    this.ctx = null;
  }
  get enabled() {
    return this._enabled;
  }
  set enabled(value) {
    this._enabled = !!value;
    if (!value) {
      this.stopMusic();
      for (const source of this.activeSources) {
        try {
          source.stop();
        } catch {}
      }
      this.activeSources.clear();
    }
  }
  setScene(scene) {
    if (scene !== this.scene) {
      this.stopMusic();
      this.scene = scene;
    }
    this.ensureMusic();
  }
  stopMusic() {
    this.token++;
    this.musicPending = false;
    if (this.music) {
      try {
        this.music.stop();
      } catch {}
      this.music = null;
    }
  }
  async loadNative(key) {
    if (!NATIVE_AUDIO_URLS[key] || !this.ctx || this.dead) return null;
    if (this.buffers.has(key)) return this.buffers.get(key);
    if (this.loading.has(key)) return this.loading.get(key);
    const ctx = this.ctx;
    const promise = fetch(NATIVE_AUDIO_URLS[key])
      .then((r) => {
        if (!r.ok) throw Error("Audio unavailable");
        return r.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        if (!this.dead) this.buffers.set(key, buffer);
        return buffer;
      })
      .catch(() => null)
      .finally(() => this.loading.delete(key));
    this.loading.set(key, promise);
    return promise;
  }
  ensureMusic() {
    if (
      !this.enabled ||
      !this.ctx ||
      this.dead ||
      this.music ||
      this.musicPending
    )
      return;
    const key = {
      formation: "musicFormation",
      battle: "musicBattle",
      boss: "musicBoss",
      victory: "musicVictory",
      defeat: "musicDefeat",
    }[this.scene];
    if (!key) return;
    this.musicPending = true;
    const token = this.token;
    this.loadNative(key)
      .then((buffer) => {
        if (
          !buffer ||
          token !== this.token ||
          !this.enabled ||
          this.dead ||
          !this.ctx
        )
          return;
        const source = this.ctx.createBufferSource(),
          gain = this.ctx.createGain();
        source.buffer = buffer;
        source.loop = !["victory", "defeat"].includes(this.scene);
        gain.gain.value = 0.13;
        source.connect(gain);
        gain.connect(this.ctx.destination);
        this.music = source;
        source.start();
        source.onended = () => {
          if (this.music === source) this.music = null;
          gain.disconnect();
        };
      })
      .finally(() => {
        if (token === this.token) this.musicPending = false;
      });
  }
  native(key) {
    if (!this.enabled || this.dead || !NATIVE_AUDIO_URLS[key]) return false;
    this.unlock();
    this.loadNative(key).then((buffer) => {
      if (!buffer || !this.enabled || this.dead || !this.ctx) return;
      const source = this.ctx.createBufferSource(),
        gain = this.ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = 0.48;
      source.connect(gain);
      gain.connect(this.ctx.destination);
      source.start();
      this.activeSources.add(source);
      source.onended = () => {
        this.activeSources.delete(source);
        gain.disconnect();
      };
    });
    return true;
  }
  cast(action, nativeHeroId) {
    const hero = APK_HERO_CONFIG[nativeHeroId];
    const key =
      action.nativeConfig?.attackSound ||
      (action.heroSkill ? hero?.skillSound : hero?.attackSound);
    if (!this.native(key)) this.play(action.heroSkill ? "spell" : "hit");
  }
  impact(action) {
    if (!this.native(action.nativeConfig?.impactSound)) this.play("hit");
  }
  unlock() {
    if (!this.enabled) return;
    try {
      this.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      this.ctx.resume().catch(() => {});
      this.ensureMusic();
    } catch {}
  }
  destroy() {
    this.enabled = false;
    this.dead = true;
    this.buffers.clear();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
  play(type = "tap") {
    if (!this.enabled) return;
    const key = { tap: "tap", win: "level", chest: "chest" }[type];
    if (key && this.native(key)) return;
    this.unlock();
    if (!this.ctx) return;
    const notes =
      type === "win"
        ? [523, 659, 784, 1046]
        : type === "spell"
          ? [330, 494, 660]
          : type === "hit"
            ? [150, 95]
            : [440, 554];
    notes.forEach((f, i) => {
      const osc = this.ctx.createOscillator(),
        g = this.ctx.createGain(),
        t = this.ctx.currentTime + i * 0.08;
      osc.type = type === "hit" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.055, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }
}
