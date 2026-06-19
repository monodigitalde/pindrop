import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Api } from './api';
import type { Comment } from './types';
import { buildAnchor, getDocSize, resolvePosition, type Anchor } from './anchor';
import { colorFor, initials, pageKey, timeAgo } from './utils';

interface WidgetProps {
  api: Api;
}

interface Draft {
  /** Element anchor + fallback position, persisted with the comment. */
  anchor: Anchor;
  /** Viewport coords for placing the compose popup. */
  clientX: number;
  clientY: number;
}

const AUTHOR_KEY = 'pindrop:author';

export function Widget({ api }: WidgetProps) {
  const url = useMemo(() => pageKey(), []);
  const [comments, setComments] = useState<Comment[]>([]);
  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [docSize, setDocSize] = useState(getDocSize);

  // Load existing comments for this page.
  useEffect(() => {
    let alive = true;
    api
      .list(url)
      .then((list) => {
        if (alive) setComments(list);
      })
      .catch((err) => console.warn('[pindrop] load failed:', err));
    return () => {
      alive = false;
    };
  }, [api, url]);

  // Keep the pin layer sized to the document as it changes / on resize.
  useEffect(() => {
    const update = () => setDocSize(getDocSize());
    update();
    window.addEventListener('resize', update);
    const ro = new ResizeObserver(update);
    ro.observe(document.documentElement);
    return () => {
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, []);

  const cancel = useCallback(() => {
    setPlacing(false);
    setDraft(null);
  }, []);

  // ESC cancels placing / closes popups.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancel();
        setOpenId(null);
        setHoverId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancel]);

  // Clicking outside the open comment card (or a pin) closes it.
  useEffect(() => {
    if (!openId) return;
    const onDown = (e: MouseEvent) => {
      const insideWidget = e
        .composedPath()
        .some(
          (el) =>
            el instanceof Element &&
            (el.classList.contains('fw-card') || el.classList.contains('fw-pin-marker')),
        );
      if (!insideWidget) setOpenId(null);
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [openId]);

  const togglePlacing = useCallback(() => {
    setOpenId(null);
    setDraft(null);
    setPlacing((p) => !p);
  }, []);

  const onCatcherClick = useCallback((e: MouseEvent) => {
    setDraft({
      anchor: buildAnchor(e.clientX, e.clientY),
      clientX: e.clientX,
      clientY: e.clientY,
    });
    setDocSize(getDocSize());
    setPlacing(false);
  }, []);

  const submit = useCallback(
    async (author: string, text: string) => {
      if (!draft) return;
      const { anchor } = draft;
      const created = await api.create({
        url,
        x: anchor.x,
        y: anchor.y,
        selector: anchor.selector,
        relX: anchor.relX,
        relY: anchor.relY,
        author,
        text,
      });
      setComments((prev) => [...prev, created]);
      setDraft(null);
      setOpenId(created.id);
    },
    [api, draft, url],
  );

  const remove = useCallback(
    async (id: string) => {
      const prev = comments;
      setComments((c) => c.filter((x) => x.id !== id));
      setOpenId(null);
      try {
        await api.remove(id);
      } catch (err) {
        console.warn('[pindrop] delete failed:', err);
        setComments(prev); // rollback
      }
    },
    [api, comments],
  );

  const reply = useCallback(
    async (commentId: string, author: string, text: string) => {
      const created = await api.reply(commentId, { author, text });
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, replies: [...c.replies, created] } : c,
        ),
      );
    },
    [api],
  );

  return (
    <div class="fw-root">
      {placing && (
        <>
          <div
            class="fw-catcher"
            onClick={onCatcherClick}
            role="presentation"
            aria-hidden="true"
          />
          <div class="fw-hint">
            <DotIcon /> Click anywhere to leave feedback
            <kbd>ESC</kbd>
          </div>
        </>
      )}

      <div class="fw-pins" style={{ width: docSize.w + 'px', height: docSize.h + 'px' }}>
        {comments.map((c, i) => {
          const { px, py } = resolvePosition(c, docSize);
          return (
            <Pin
              key={c.id}
              comment={c}
              index={i + 1}
              px={px}
              py={py}
              docW={docSize.w}
              docH={docSize.h}
              open={openId === c.id || hoverId === c.id}
              onToggle={() => setOpenId((id) => (id === c.id ? null : c.id))}
              onClose={() => {
                setOpenId(null);
                setHoverId(null);
              }}
              onHover={(v) => setHoverId(v ? c.id : null)}
              onDelete={() => remove(c.id)}
              onReply={(author, text) => reply(c.id, author, text)}
            />
          );
        })}
      </div>

      {draft && (
        <ComposePopup
          x={draft.clientX}
          y={draft.clientY}
          onCancel={() => setDraft(null)}
          onSubmit={submit}
        />
      )}

      <button
        class={'fw-fab' + (placing ? ' is-active' : '')}
        onClick={togglePlacing}
        title={placing ? 'Cancel' : 'Give feedback'}
        aria-label={placing ? 'Exit feedback mode' : 'Give feedback'}
      >
        {placing ? <CloseIcon /> : <ChatIcon />}
        {!placing && comments.length > 0 && (
          <span class="fw-badge">{comments.length > 99 ? '99+' : comments.length}</span>
        )}
      </button>
    </div>
  );
}

/* ------------------------------- Pin -------------------------------- */

interface PinProps {
  comment: Comment;
  index: number;
  px: number;
  py: number;
  docW: number;
  docH: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onHover: (v: boolean) => void;
  onDelete: () => void;
  onReply: (author: string, text: string) => Promise<void>;
}

const GAP = 16;
// Pins are uniformly red — the feedback signal color, matching the badge.
const PIN_BG = 'linear-gradient(135deg, #fb7185 0%, #f43f5e 50%, #e11d48 100%)';

function Pin({ comment, index, px, py, docW, docH, open, onToggle, onClose, onHover, onDelete, onReply }: PinProps) {
  const color = colorFor(comment.author);
  const cardRef = useRef<HTMLDivElement>(null);
  // Card offset relative to the pin point. Refined after measuring (pre-paint).
  const [offset, setOffset] = useState({ dx: GAP, dy: -120 });

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyAuthor, setReplyAuthor] = useState(() => localStorage.getItem(AUTHOR_KEY) ?? '');
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);

  useLayoutEffect(() => {
    if (!open || !cardRef.current) return;
    const w = cardRef.current.offsetWidth;
    const h = cardRef.current.offsetHeight;

    // Horizontal: prefer right of the pin, flip left on overflow, then clamp.
    let absLeft = px + GAP;
    if (absLeft + w > docW - 8) absLeft = px - GAP - w;
    absLeft = Math.max(8, Math.min(absLeft, Math.max(8, docW - w - 8)));

    // Vertical: prefer above the pin, flip below on overflow, then clamp.
    let absTop = py - h - GAP;
    if (absTop < 8) absTop = py + GAP;
    absTop = Math.max(8, Math.min(absTop, Math.max(8, docH - h - 8)));

    setOffset({ dx: absLeft - px, dy: absTop - py });
  }, [open, px, py, docW, docH, comment.text, comment.replies.length, replyOpen]);

  const canReply = replyAuthor.trim().length > 0 && replyText.trim().length > 0 && !replyBusy;

  const sendReply = async () => {
    if (!canReply) return;
    setReplyBusy(true);
    try {
      localStorage.setItem(AUTHOR_KEY, replyAuthor.trim());
      await onReply(replyAuthor.trim(), replyText.trim());
      setReplyText('');
    } catch (err) {
      console.warn('[pindrop] reply failed:', err);
    } finally {
      setReplyBusy(false);
    }
  };

  return (
    <div
      class={'fw-pin' + (open ? ' is-open' : '')}
      style={{ left: px + 'px', top: py + 'px' }}
    >
      <div
        class="fw-pin-marker"
        style={{ background: PIN_BG }}
        onClick={onToggle}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        role="button"
        tabIndex={0}
        aria-label={`Comment from ${comment.author}`}
      >
        <span>{index}</span>
      </div>
      {open && (
        <div
          ref={cardRef}
          class="fw-card"
          style={{ left: offset.dx + 'px', top: offset.dy + 'px' }}
          onMouseEnter={() => onHover(true)}
          onMouseLeave={() => onHover(false)}
        >
          <div class="fw-card-body">
            <div class="fw-card-head">
              <div class="fw-avatar" style={{ background: color }}>
                {initials(comment.author)}
              </div>
              <div class="fw-meta">
                <div class="fw-author">{comment.author}</div>
                <div class="fw-time">{timeAgo(comment.created_at)}</div>
              </div>
              <div class="fw-card-tools">
                <button class="fw-icon-btn fw-danger" onClick={onDelete} title="Delete" aria-label="Delete">
                  <TrashIcon />
                </button>
                <button class="fw-icon-btn" onClick={onClose} title="Close" aria-label="Close">
                  <CloseIcon />
                </button>
              </div>
            </div>
            <div class="fw-text">{comment.text}</div>

            {comment.replies.length > 0 && (
              <div class="fw-replies">
                {comment.replies.map((r) => (
                  <div class="fw-reply" key={r.id}>
                    <div class="fw-reply-avatar" style={{ background: colorFor(r.author) }}>
                      {initials(r.author)}
                    </div>
                    <div class="fw-reply-body">
                      <div class="fw-reply-meta">
                        <span class="fw-reply-author">{r.author}</span>
                        <span class="fw-time">{timeAgo(r.created_at)}</span>
                      </div>
                      <div class="fw-text">{r.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {replyOpen ? (
              <div class="fw-reply-form">
                <input
                  class="fw-field"
                  type="text"
                  placeholder="Your name"
                  value={replyAuthor}
                  maxLength={80}
                  onInput={(e) => setReplyAuthor((e.target as HTMLInputElement).value)}
                />
                <input
                  class="fw-field"
                  type="text"
                  placeholder="Write a reply …"
                  value={replyText}
                  maxLength={2000}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  onInput={(e) => setReplyText((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                />
                <div class="fw-card-actions">
                  <button type="button" class="fw-btn fw-btn-ghost" onClick={() => setReplyOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" class="fw-btn fw-btn-primary" disabled={!canReply} onClick={sendReply}>
                    {replyBusy ? 'Sending …' : 'Reply'}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" class="fw-reply-toggle" onClick={() => setReplyOpen(true)}>
                <ReplyIcon /> Reply{comment.replies.length > 0 ? ` (${comment.replies.length})` : ''}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------- ComposePopup --------------------------- */

interface ComposeProps {
  x: number;
  y: number;
  onCancel: () => void;
  onSubmit: (author: string, text: string) => Promise<void>;
}

function ComposePopup({ x, y, onCancel, onSubmit }: ComposeProps) {
  const [author, setAuthor] = useState(() => localStorage.getItem(AUTHOR_KEY) ?? '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Start near the click; refined to the measured box before paint.
  const [pos, setPos] = useState({ left: x + 14, top: y + 14 });

  useEffect(() => {
    // Focus the most useful field once, on mount: the comment box if the name
    // is already known, otherwise the name field. Must NOT depend on `author`,
    // or focus would jump to the textarea on the first keystroke.
    if (textRef.current) {
      const initial = textRef.current.previousElementSibling as HTMLInputElement | null;
      (initial?.value ? textRef.current : initial)?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    // Clamp into the viewport using the popup's measured size. Prefer placing it
    // down-right of the click; flip when it would overflow.
    const el = formRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = x + 14;
    if (left + w > vw - 12) left = x - 14 - w;
    left = Math.max(12, Math.min(left, Math.max(12, vw - w - 12)));

    let top = y + 14;
    if (top + h > vh - 12) top = y - 14 - h;
    top = Math.max(12, Math.min(top, Math.max(12, vh - h - 12)));

    setPos({ left, top });
  }, [x, y, error]);

  const canSubmit = author.trim().length > 0 && text.trim().length > 0 && !busy;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      localStorage.setItem(AUTHOR_KEY, author.trim());
      await onSubmit(author.trim(), text.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
      setBusy(false);
    }
  };

  return (
    <form
      ref={formRef}
      class="fw-card is-fixed"
      style={{ left: pos.left + 'px', top: pos.top + 'px' }}
      onSubmit={handleSubmit}
    >
      <div class="fw-card-body">
        <input
          class="fw-field"
          type="text"
          placeholder="Your name"
          value={author}
          maxLength={80}
          onInput={(e) => setAuthor((e.target as HTMLInputElement).value)}
        />
        <textarea
          ref={textRef}
          class="fw-field"
          placeholder="Your feedback …"
          value={text}
          maxLength={2000}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          onKeyDown={(e) => {
            // Enter submits; Shift+Enter inserts a newline.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        {error && <div class="fw-error">{error}</div>}
        <div class="fw-card-actions">
          <button type="button" class="fw-btn fw-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" class="fw-btn fw-btn-primary" disabled={!canSubmit}>
            {busy ? 'Sending …' : 'Send'}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ------------------------------- Icons ------------------------------ */

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ opacity: 0.55 }}>
      <circle cx="12" cy="12" r="6" />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}
