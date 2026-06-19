// All widget styling lives here as a single CSS string injected into the
// Shadow DOM. Scoped to the shadow root, so nothing leaks in or out.
export const styles = /* css */ `
:host {
  all: initial;
}

*, *::before, *::after { box-sizing: border-box; }

.fw-root {
  --fw-accent: #334155;
  --fw-accent-strong: #0f172a;
  --fw-bg: rgba(255, 255, 255, 0.92);
  --fw-bg-solid: #ffffff;
  --fw-fg: #0f172a;
  --fw-muted: #64748b;
  --fw-border: rgba(15, 23, 42, 0.08);
  --fw-ring: rgba(51, 65, 85, 0.3);
  --fw-shadow: 0 10px 40px -8px rgba(15, 23, 42, 0.28), 0 2px 8px -2px rgba(15, 23, 42, 0.12);
  --fw-radius: 16px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.45;
  color: var(--fw-fg);
  -webkit-font-smoothing: antialiased;
}

@media (prefers-color-scheme: dark) {
  .fw-root {
    --fw-bg: rgba(20, 24, 38, 0.92);
    --fw-bg-solid: #161a26;
    --fw-fg: #f1f5f9;
    --fw-muted: #94a3b8;
    --fw-border: rgba(255, 255, 255, 0.1);
    --fw-shadow: 0 10px 40px -8px rgba(0, 0, 0, 0.6), 0 2px 8px -2px rgba(0, 0, 0, 0.4);
  }
}

/* ---------- Floating launcher button ---------- */
.fw-fab {
  position: fixed;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(135deg, #475569 0%, var(--fw-accent) 55%, var(--fw-accent-strong) 100%);
  box-shadow: 0 8px 24px -4px rgba(15, 23, 42, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.06);
  transition: transform .22s cubic-bezier(.34,1.56,.64,1), box-shadow .22s ease, filter .2s ease;
  z-index: 2;
}
.fw-fab:hover { transform: translateY(calc(-50% - 2px)) scale(1.04); box-shadow: 0 14px 32px -4px rgba(15,23,42,.5), 0 0 0 1px rgba(255,255,255,.08); }
.fw-fab:active { transform: translateY(-50%) scale(.96); }
.fw-fab svg { width: 24px; height: 24px; }
.fw-fab.is-active {
  background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
  box-shadow: 0 8px 24px -4px rgba(225, 29, 72, .5);
}

.fw-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: #f43f5e;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: grid;
  place-items: center;
  border: 2px solid var(--fw-bg-solid);
  box-shadow: 0 2px 6px rgba(225,29,72,.4);
}

/* ---------- Crosshair / placing mode ---------- */
.fw-catcher {
  position: fixed;
  inset: 0;
  cursor: crosshair;
  z-index: 1;
  background: rgba(99,102,241,0.04);
}
.fw-hint {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  background: var(--fw-bg);
  backdrop-filter: blur(12px) saturate(160%);
  -webkit-backdrop-filter: blur(12px) saturate(160%);
  border: 1px solid var(--fw-border);
  border-radius: 999px;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 500;
  color: var(--fw-fg);
  box-shadow: var(--fw-shadow);
  display: flex;
  align-items: center;
  gap: 10px;
  animation: fw-drop .3s cubic-bezier(.34,1.56,.64,1);
}
.fw-hint kbd {
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  background: rgba(15,23,42,.08);
  border-radius: 6px;
  padding: 2px 7px;
}
@media (prefers-color-scheme: dark) { .fw-hint kbd { background: rgba(255,255,255,.12); } }

/* ---------- Pins layer (spans the whole document) ---------- */
.fw-pins {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
.fw-pin {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
  z-index: 1;
}
.fw-pin.is-open { z-index: 4; }
.fw-pin-marker {
  position: absolute;
  left: 0;
  top: 0;
  width: 30px;
  height: 30px;
  border-radius: 50% 50% 50% 2px;
  transform: translate(-50%, -100%) rotate(-45deg);
  transform-origin: center;
  display: grid;
  place-items: center;
  border: 2px solid #fff;
  cursor: pointer;
  pointer-events: auto;
  filter: drop-shadow(0 4px 8px rgba(15,23,42,.28));
  transition: transform .18s ease;
  animation: fw-pop .32s cubic-bezier(.34,1.56,.64,1);
}
.fw-pin-marker:hover { transform: translate(-50%, -100%) rotate(-45deg) scale(1.14); }
.fw-pin-marker span {
  transform: rotate(45deg);
  color: #fff;
  font-weight: 700;
  font-size: 12px;
}

/* ---------- Comment card (tooltip + compose share styling) ---------- */
.fw-card {
  position: absolute;
  pointer-events: auto;
  z-index: 5;
  width: 280px;
  background: var(--fw-bg);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  border: 1px solid var(--fw-border);
  border-radius: var(--fw-radius);
  box-shadow: var(--fw-shadow);
  overflow: hidden;
  animation: fw-pop .22s cubic-bezier(.34,1.56,.64,1);
}
.fw-card.is-fixed { position: fixed; }
.fw-card-body { padding: 14px 16px; }

.fw-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.fw-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 700;
  font-size: 12px;
  flex: none;
}
.fw-meta { min-width: 0; }
.fw-author { font-weight: 600; font-size: 13px; line-height: 1.2; }
.fw-time { color: var(--fw-muted); font-size: 11px; }
.fw-text {
  font-size: 13.5px;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--fw-fg);
}

.fw-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

/* ---------- Replies / thread ---------- */
.fw-replies {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--fw-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 220px;
  overflow-y: auto;
}
.fw-reply { display: flex; gap: 8px; }
.fw-reply-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 700;
  font-size: 9px;
  flex: none;
  margin-top: 1px;
}
.fw-reply-body { min-width: 0; }
.fw-reply-meta { display: flex; align-items: baseline; gap: 6px; margin-bottom: 1px; }
.fw-reply-author { font-weight: 600; font-size: 12px; }
.fw-reply .fw-text { font-size: 13px; }

.fw-reply-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 6px 10px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--fw-muted);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s ease, color .15s ease;
}
.fw-reply-toggle:hover { background: rgba(15,23,42,.06); color: var(--fw-fg); }
@media (prefers-color-scheme: dark) { .fw-reply-toggle:hover { background: rgba(255,255,255,.08); } }
.fw-reply-toggle svg { width: 15px; height: 15px; }

.fw-reply-form {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--fw-border);
}

/* ---------- Form ---------- */
.fw-field {
  width: 100%;
  background: var(--fw-bg-solid);
  border: 1px solid var(--fw-border);
  border-radius: 10px;
  padding: 9px 11px;
  font: inherit;
  font-size: 13.5px;
  color: var(--fw-fg);
  outline: none;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.fw-field::placeholder { color: var(--fw-muted); }
.fw-field:focus { border-color: var(--fw-accent); box-shadow: 0 0 0 3px var(--fw-ring); }
.fw-field + .fw-field { margin-top: 8px; }
textarea.fw-field { resize: none; min-height: 76px; line-height: 1.45; }

.fw-btn {
  border: none;
  border-radius: 10px;
  padding: 8px 14px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s ease, transform .1s ease, opacity .15s ease;
}
.fw-btn:active { transform: scale(.97); }
.fw-btn-primary {
  background: linear-gradient(135deg, var(--fw-accent) 0%, var(--fw-accent-strong) 100%);
  color: #fff;
  box-shadow: 0 2px 8px -1px rgba(79,70,229,.45);
}
.fw-btn-primary:hover { filter: brightness(1.06); }
.fw-btn-primary:disabled { opacity: .5; cursor: not-allowed; filter: none; }
.fw-btn-ghost { background: transparent; color: var(--fw-muted); }
.fw-btn-ghost:hover { background: rgba(15,23,42,.06); color: var(--fw-fg); }
@media (prefers-color-scheme: dark) { .fw-btn-ghost:hover { background: rgba(255,255,255,.08); } }

.fw-card-tools { margin-left: auto; display: flex; gap: 2px; }
.fw-icon-btn {
  border: none;
  background: transparent;
  color: var(--fw-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  transition: background .15s ease, color .15s ease;
}
.fw-icon-btn:hover { background: rgba(15,23,42,.06); color: var(--fw-fg); }
.fw-icon-btn.fw-danger:hover { background: rgba(244,63,94,.12); color: #f43f5e; }
.fw-icon-btn svg { width: 16px; height: 16px; }
@media (prefers-color-scheme: dark) { .fw-icon-btn:hover { background: rgba(255,255,255,.08); } }

.fw-error {
  color: #ef4444;
  font-size: 12px;
  margin-top: 8px;
}

@keyframes fw-pop {
  from { opacity: 0; transform: scale(.92) translateY(4px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes fw-drop {
  from { opacity: 0; transform: translate(-50%, -8px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .fw-fab, .fw-pin, .fw-card, .fw-hint, .fw-pin-marker { animation: none !important; transition: none !important; }
}
`;
