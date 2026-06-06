# ✓ Liftoff Todo

A deliberately tiny **todo app** — one Express service, one file — built to deploy
**cleanly on [Liftoff](https://github.com/Liftoff-Launchpad/liftoff)** with zero fuss.

It's intentionally simple so the deploy "just works":
- **Single service, Dockerfile at the repo root** → Liftoff's default service builds it directly (no extra services to add, no source folder to set).
- **Listens on `$PORT` bound to `0.0.0.0`** → no "container exited early" errors.
- **Boots with an in-memory store** → deploys with **no managed resources required**.
- **Optional Postgres** → if `DATABASE_URL` is present it persists to Postgres; if not (or if the DB is unreachable) it falls back to in-memory instead of crash-looping.

---

## Deploy on Liftoff (the easy path)
1. **New Project** → give it a name.
2. **Connect repository** → pick this repo. Liftoff builds the root `Dockerfile` and deploys the one service.
3. Open the service's **endpoint URL** when it goes green — that's the todo app.

That's it. The app runs immediately with an in-memory store (todos reset on redeploy).

### Want persistence? (optional)
On the canvas: add a **PostgreSQL** resource node, draw an edge **Postgres → todo** (Liftoff injects `DATABASE_URL`), then **Deploy**. The app picks it up automatically and creates the `todos` table. The footer of the page shows the active store (`memory` or `postgres`).

> Tip: keep replicas at 1 if you stay on the in-memory store (each replica has its own list).

---

## Run locally
```bash
npm install
npm start          # http://localhost:8080  (in-memory store)
```
With Postgres:
```bash
DATABASE_URL=postgres://user:pass@localhost:5432/todo npm start
```

## API
| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/` | — | The todo UI |
| GET | `/health` | — | `{ status, store }` |
| GET | `/api/todos` | — | List todos |
| POST | `/api/todos` | `{ "title": "..." }` | Create a todo |
| PATCH | `/api/todos/:id` | `{ "done": true }` | Toggle done |
| DELETE | `/api/todos/:id` | — | Delete a todo |

---

## Files
```
liftoff-todo/
├── index.js        # the whole app (server + API + inline UI)
├── package.json
├── Dockerfile      # root-level → Liftoff builds this directly
├── liftoff.yml     # single-service config (optional Postgres commented out)
└── README.md
```
