/**
 * Centralized audio manager for the Defumar frontend.
 *
 * Rules:
 *  - SSR safe — never touches `window` at module load.
 *  - The AudioContext is created ONLY inside `enable()`, which must be called
 *    from a real user gesture (click/keydown/touch). Never in effects/sockets.
 *  - Persists the enabled flag in localStorage under `defumar_audio_enabled`.
 *  - `playBeep()` fails silently when disabled or when the context is suspended.
 *  - Built-in 3s debounce protects against event avalanches.
 */

const STORAGE_KEY = "defumar_audio_enabled";
const MIN_INTERVAL_MS = 3000;

export type BeepVariant = "default" | "soft" | "alert" | "silent";

type Listener = (enabled: boolean) => void;

class AudioManager {
  private ctx: AudioContext | null = null;
  private enabled = false;
  private lastPlayedAt = 0;
  private listeners = new Set<Listener>();
  private hydrated = false;

  private hydrate() {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;
    this.enabled = window.localStorage.getItem(STORAGE_KEY) === "true";
  }

  isEnabled(): boolean {
    this.hydrate();
    return this.enabled;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) l(this.enabled);
  }

  private persist() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, this.enabled ? "true" : "false");
  }

  /** Must be called from a user gesture (onClick handler). */
  async enable(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if (!this.ctx) {
      const Ctx =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return false;
      try {
        this.ctx = new Ctx();
      } catch {
        this.ctx = null;
        return false;
      }
    }
    try {
      if (this.ctx.state === "suspended") await this.ctx.resume();
    } catch {
      /* ignore */
    }
    this.enabled = this.ctx.state === "running";
    this.persist();
    this.emit();
    return this.enabled;
  }

  disable() {
    this.enabled = false;
    this.persist();
    this.emit();
  }

  async toggle(): Promise<boolean> {
    if (this.enabled) {
      this.disable();
      return false;
    }
    return this.enable();
  }

  /** Silent no-op when disabled, suspended, debounced, or unavailable. */
  playBeep(variant: BeepVariant = "default") {
    if (variant === "silent") return;
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state !== "running") return;
    const now = Date.now();
    if (now - this.lastPlayedAt < MIN_INTERVAL_MS) return;
    this.lastPlayedAt = now;

    const ctx = this.ctx;
    try {
      const beep = (freq: number, start: number, dur: number, vol = 0.25) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = variant === "alert" ? "square" : "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur + 0.02);
      };
      if (variant === "soft") {
        beep(660, 0, 0.22, 0.12);
      } else if (variant === "alert") {
        beep(880, 0, 0.18, 0.3);
        beep(660, 0.22, 0.18, 0.3);
        beep(880, 0.44, 0.22, 0.3);
      } else {
        beep(880, 0, 0.18);
        beep(1320, 0.2, 0.22);
      }
    } catch {
      /* ignore */
    }
  }
}

export const audioManager = new AudioManager();
