<div align="center">

# 📍 Pindrop

### Pin feedback right on the page.

Self-hosted, open-source visual feedback for staging sites. Your clients pin
comments directly onto the page — like Vercel Toolbar or BugHerd, but yours,
in one Docker container, with no login and no SaaS.

![license](https://img.shields.io/badge/license-MIT-blue) ![bundle](https://img.shields.io/badge/widget-~13_kB_gzip-brightgreen) ![docker](https://img.shields.io/badge/docker-ghcr.io-blue)

</div>

---

## Why Pindrop

A web agency shares an HTML staging build with a client. Instead of emailing
*"the headline on the pricing page feels too small"*, the client clicks the spot
and leaves a note right there. Everyone with the link sees the pins. No accounts,
no setup on the client's side.

- 📍 **Pin anywhere** — click a spot, leave a note. Pins are anchored to the
  element, so they stay put even when the layout reflows on other screen sizes.
- 💬 **Threaded replies** — anyone can reply to a pin in a compact thread.
- 🗂️ **Per-page** — each URL keeps its own set of pins.
- 👥 **No auth** — anyone with the link reads, adds, replies, and resolves.
- 🪶 **Tiny** — ~13 kB gzipped, mounted in a **Shadow DOM** (zero CSS conflicts).
- 🐳 **One container** — plain HTTP, SQLite storage, drops into any Docker stack.
- 🌓 Respects light/dark mode and reduced-motion.

---

## How it works

```
┌──────────────┐   <script src="/pindrop/widget.js">    ┌──────────────────┐
│   Your app   │ ────────────────────────────────────▶ │     Pindrop      │
│  (staging)   │ ◀──────────────  pins  ─────────────── │  Hono + SQLite   │
└──────────────┘     GET/POST /pindrop/api/comments     └──────────────────┘
```

Pindrop is a single container serving a self-mounting `widget.js`. The widget
figures out its own API URL from the script's `src`, so it works same-origin or
cross-origin. Storage is a SQLite file on a volume.

> **Not tied to Traefik.** Pindrop is just an HTTP server on port `4878`. It runs
> behind any reverse proxy — or none. Traefik only shows up below as *one* way to
> auto-inject the script tag; it's optional.

---

## Quickstart

### 1. Run the container

```yaml
# docker-compose.yml
services:
  pindrop:
    image: ghcr.io/monodigitalde/pindrop:latest
    ports:
      - "4878:4878"          # or route /pindrop through your proxy
    environment:
      - ENABLED=true
    volumes:
      - pindrop-data:/data

volumes:
  pindrop-data:
```

### 2. Add the widget to your page

Drop one line into your staging site's HTML — that's it:

```html
<script src="https://staging.example.com/pindrop/widget.js"></script>
```

(If Pindrop runs on the same host/path prefix as your app, a relative
`/pindrop/widget.js` works too.)

### 3. Try it

Pindrop ships a demo staging **site with two subpages** so you can see per-page
pins in action:

```
https://staging.example.com/pindrop/demo         # Home
https://staging.example.com/pindrop/demo/about    # About — its own pins
```

Click the floating button (center-right) → click anywhere → leave a comment.
Switch between Home and About: each page keeps its own set of pins.

---

## Using the widget

- **Floating button** (center-right) toggles feedback mode → the cursor becomes a
  crosshair.
- **Click a spot** → a popup opens. Enter your name and comment.
  **Enter** submits, **Shift+Enter** adds a newline. Your name is remembered.
- **Pins** are red and numbered; the button shows a badge with the open count.
- **Click a pin** to open its card: author, comment, and a **threaded reply**
  composer. Reply, delete, or close it.
- **Close** a card with the **✕ button**, a click on empty space, or **Esc**.

---

## Integration options

### A) Manual script tag *(recommended — works everywhere)*

```html
<script src="/pindrop/widget.js"></script>
```

Nothing else needed. Toggle it per environment with the `ENABLED` env var.

### B) Auto-inject via your reverse proxy

Let the proxy insert the tag into HTML responses so you don't touch the app:

<details>
<summary><b>Traefik</b> (injectbody plugin)</summary>

Enable the plugin in Traefik's **static** config:

```yaml
experimental:
  plugins:
    injectbody:
      moduleName: github.com/traefik/plugin-rewritebody
      version: v0.3.1
```

Then add labels to your app service (see [`docker-compose.example.yml`](./docker-compose.example.yml)):

```yaml
- "traefik.http.middlewares.pindrop-inject.plugin.injectbody.lastBody=</body>"
- "traefik.http.middlewares.pindrop-inject.plugin.injectbody.body=<script src='/pindrop/widget.js'></script></body>"
- "traefik.http.routers.myapp.middlewares=pindrop-inject"
```
</details>

<details>
<summary><b>nginx</b> (sub_filter)</summary>

```nginx
location / {
    proxy_pass http://myapp;
    sub_filter '</body>' '<script src="/pindrop/widget.js"></script></body>';
    sub_filter_once on;
    proxy_set_header Accept-Encoding "";   # so responses are uncompressed for filtering
}
location /pindrop/ {
    proxy_pass http://pindrop:4878;
}
```
</details>

<details>
<summary><b>Caddy</b> (replace handler)</summary>

```caddyfile
staging.example.com {
    handle_path /pindrop/* {
        reverse_proxy pindrop:4878
    }
    reverse_proxy myapp {
        # requires the caddy-replace-response / templates plugin
        replace "</body>" "<script src='/pindrop/widget.js'></script></body>"
    }
}
```
</details>

---

## Configuration

| Variable          | Default            | Description                                               |
| ----------------- | ------------------ | --------------------------------------------------------- |
| `ENABLED`         | `true`             | When `false`, `widget.js` serves an empty no-op script.   |
| `PORT`            | `4878`             | HTTP port the server listens on.                          |
| `DB_PATH`         | `/data/db.sqlite`  | SQLite file path (mount a volume here to persist).        |
| `ALLOWED_ORIGINS` | `*`                | CORS allow-list, comma-separated, or `*` for any origin.  |
| `BASE_PATH`       | `pindrop`          | Public path prefix for the widget + API.                  |
| `WIDGET_JS_PATH`  | _(auto)_           | Override path to the built `widget.js` bundle.            |

Need the widget to talk to an API on a different origin? Set it before the script
loads:

```html
<script>window.PINDROP_CONFIG = { apiBase: 'https://feedback.example.com/pindrop/api' };</script>
<script src="https://feedback.example.com/pindrop/widget.js"></script>
```

---

## API

Base prefix is `/pindrop` (configurable via `BASE_PATH`).

| Method   | Path                                   | Description                          |
| -------- | -------------------------------------- | ------------------------------------ |
| `GET`    | `/pindrop/api/comments?url=<url>`      | List comments for a page (with replies). |
| `POST`   | `/pindrop/api/comments`                | Create a comment.                    |
| `POST`   | `/pindrop/api/comments/:id/replies`    | Reply to a comment.                  |
| `DELETE` | `/pindrop/api/comments/:id`            | Delete a comment (and its replies).  |
| `GET`    | `/pindrop/widget.js`                   | The widget bundle.                   |
| `GET`    | `/pindrop/health`                      | Health check.                        |
| `GET`    | `/pindrop/demo`, `/pindrop/demo/about` | Demo staging site (two subpages).    |

**Comment shape**

```jsonc
{
  "id": "uuid",
  "url": "https://staging.example.com/pricing",
  "x": 47.2,          // % from left of the document (fallback)
  "y": 46.7,          // % from top of the document (fallback)
  "selector": "main > section:nth-of-type(2) > h2",  // anchored element
  "relX": 0.5,        // click offset within that element (0-1)
  "relY": 0.25,
  "author": "Jonas",
  "text": "Headline should be larger.",
  "created_at": "2026-06-19T08:00:00.000Z",
  "replies": [
    { "id": "uuid", "author": "Alex", "text": "On it.", "created_at": "…" }
  ]
}
```

> ⚠️ There is **no authentication** by design — anyone with the link can read,
> add, reply to, and delete comments. Use it for staging/review, not production,
> and put it behind basic auth or an allow-list if your staging host is public.

---

## Development

Monorepo with npm workspaces (`packages/widget`, `packages/server`).

```bash
npm install          # installs both workspaces (needs a C++ toolchain for better-sqlite3)

npm run build        # build the widget bundle, then the server
npm test             # run widget + server test suites

# Live dev: build the widget once, then run the server with watch.
npm run build:widget
npm run dev          # → http://localhost:4878/pindrop/demo
```

| Package           | Stack                                    |
| ----------------- | ---------------------------------------- |
| `packages/widget` | Vite + Preact, Shadow DOM, IIFE bundle   |
| `packages/server` | Hono + `better-sqlite3` (Node 22)        |

### Build the image locally

```bash
docker build -t pindrop .
docker run --rm -p 4878:4878 -v $(pwd)/data:/data pindrop
# open http://localhost:4878/pindrop/demo
```

---

## Releases

Pushing to `main` or tagging `v*` triggers
[`.github/workflows/release.yml`](./.github/workflows/release.yml), which runs the
tests and publishes a multi-arch image (`linux/amd64`, `linux/arm64`) to
`ghcr.io/monodigitalde/pindrop`:

- `:latest` — latest `main`
- `:sha-<hash>` — every commit
- `:v1.2.3`, `:v1.2`, `:v1` — on git tags

---

## License

[MIT](./LICENSE) © monodigital
