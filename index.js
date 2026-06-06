'use strict';
// Liftoff Todo — a deliberately tiny single-service app.
// - Listens on process.env.PORT (App Platform sets it) bound to 0.0.0.0.
// - Boots with an in-memory store so it deploys with NO managed resources.
// - If DATABASE_URL is present (wire a Postgres node on the Liftoff canvas),
//   it uses Postgres for persistence; if the DB is unreachable it falls back
//   to memory instead of crash-looping.
const express = require('express');

const PORT = process.env.PORT || 8080;
const app = express();
app.use(express.json());

let store;

function memoryStore() {
  const items = [];
  let nextId = 1;
  return {
    kind: 'memory',
    list: async () => items.slice().sort((a, b) => b.id - a.id),
    add: async (title) => {
      const todo = { id: nextId++, title, done: false };
      items.push(todo);
      return todo;
    },
    toggle: async (id, done) => {
      const t = items.find((x) => x.id === id);
      if (t) t.done = done;
    },
    remove: async (id) => {
      const i = items.findIndex((x) => x.id === id);
      if (i >= 0) items.splice(i, 1);
    },
  };
}

function pgStore(pool) {
  return {
    kind: 'postgres',
    list: async () =>
      (await pool.query('SELECT id, title, done FROM todos ORDER BY created_at DESC, id DESC')).rows,
    add: async (title) =>
      (await pool.query('INSERT INTO todos(title) VALUES ($1) RETURNING id, title, done', [title]))
        .rows[0],
    toggle: async (id, done) => {
      await pool.query('UPDATE todos SET done = $2 WHERE id = $1', [id, done]);
    },
    remove: async (id) => {
      await pool.query('DELETE FROM todos WHERE id = $1', [id]);
    },
  };
}

async function initStore() {
  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      // DigitalOcean Managed Postgres requires TLS (its DATABASE_URL carries
      // `sslmode=require`). Accept DO's CA without bundling the cert file. Plain
      // local Postgres (no sslmode) connects without TLS.
      const url = process.env.DATABASE_URL || '';
      const needsSsl = /sslmode=(require|verify)/i.test(url) || /[?&]ssl=true/i.test(url);
      const pool = new Pool({
        connectionString: url,
        connectionTimeoutMillis: 5000,
        ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
      });
      await pool.query(`
        CREATE TABLE IF NOT EXISTS todos (
          id         SERIAL PRIMARY KEY,
          title      TEXT NOT NULL,
          done       BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      store = pgStore(pool);
      console.log('store: postgres');
      return;
    } catch (err) {
      console.warn('Postgres unavailable, using in-memory store:', err.message);
    }
  }
  store = memoryStore();
  console.log('store: in-memory');
}

// ---- API --------------------------------------------------------------------
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', store: store ? store.kind : 'starting' }));

app.get('/api/todos', async (_req, res) => res.json(await store.list()));

app.post('/api/todos', async (req, res) => {
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'title is required' });
  res.status(201).json(await store.add(title));
});

app.patch('/api/todos/:id', async (req, res) => {
  await store.toggle(Number(req.params.id), Boolean(req.body.done));
  res.json({ ok: true });
});

app.delete('/api/todos/:id', async (req, res) => {
  await store.remove(Number(req.params.id));
  res.json({ ok: true });
});

app.get('/', (_req, res) => res.type('html').send(PAGE));

initStore()
  .then(() =>
    app.listen(PORT, '0.0.0.0', () =>
      console.log(`liftoff-todo listening on :${PORT} (store=${store.kind})`)),
  )
  .catch((err) => {
    console.error('startup failed:', err);
    process.exit(1);
  });

// ---- UI (single inline page) -----------------------------------------------
const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Liftoff Todo</title>
<style>
  :root{--v:#7c5cff;--b:#2b8aef;--bg:#0c0c12;--card:#16161f;--line:#262633;--mut:#9aa0b5;--fg:#f2f2f5}
  *{box-sizing:border-box}body{margin:0;font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--fg)}
  .wrap{max-width:560px;margin:0 auto;padding:54px 20px}
  h1{font-size:30px;letter-spacing:-.02em;margin:0 0 4px}
  .grad{background:linear-gradient(95deg,var(--v),var(--b));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  p.sub{color:var(--mut);margin:0 0 26px}
  form{display:flex;gap:8px;margin-bottom:18px}
  input[type=text]{flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;color:var(--fg);font-size:15px}
  input[type=text]:focus{outline:none;border-color:var(--v)}
  button.add{background:linear-gradient(95deg,var(--v),var(--b));border:0;color:#fff;font-weight:600;border-radius:12px;padding:0 18px;cursor:pointer}
  ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
  li{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
  li .t{flex:1}li.done .t{color:var(--mut);text-decoration:line-through}
  .chk{width:20px;height:20px;border-radius:6px;border:1.5px solid var(--line);background:transparent;cursor:pointer;display:grid;place-items:center;color:#fff;flex:0 0 auto}
  li.done .chk{background:linear-gradient(95deg,var(--v),var(--b));border-color:transparent}
  .del{background:none;border:0;color:var(--mut);cursor:pointer;font-size:18px;line-height:1}
  .del:hover{color:#ff6b6b}
  .empty{color:var(--mut);text-align:center;padding:24px 0}
  .foot{color:var(--mut);font-size:12px;margin-top:24px;text-align:center}
</style></head>
<body><div class="wrap">
  <h1>✓ <span class="grad">Liftoff Todo</span></h1>
  <p class="sub">A tiny app deployed with Liftoff.</p>
  <form id="f"><input id="t" type="text" placeholder="What needs doing?" autocomplete="off" required/>
    <button class="add" type="submit">Add</button></form>
  <ul id="list"></ul>
  <p class="foot" id="foot"></p>
</div>
<script>
const list=document.getElementById('list'),foot=document.getElementById('foot');
async function load(){
  const todos=await (await fetch('/api/todos')).json();
  list.innerHTML = todos.length ? '' : '<li class="empty">Nothing yet — add your first todo.</li>';
  for(const td of todos){
    const li=document.createElement('li'); if(td.done)li.className='done';
    li.innerHTML='<button class="chk">'+(td.done?'✓':'')+'</button><span class="t"></span><button class="del">×</button>';
    li.querySelector('.t').textContent=td.title;
    li.querySelector('.chk').onclick=async()=>{await fetch('/api/todos/'+td.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({done:!td.done})});load();};
    li.querySelector('.del').onclick=async()=>{await fetch('/api/todos/'+td.id,{method:'DELETE'});load();};
    list.appendChild(li);
  }
  const h=await (await fetch('/health')).json();
  foot.textContent='store: '+h.store;
}
document.getElementById('f').onsubmit=async(e)=>{
  e.preventDefault();const t=document.getElementById('t');
  if(!t.value.trim())return;
  await fetch('/api/todos',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:t.value.trim()})});
  t.value='';load();
};
load();
</script>
</body></html>`;
