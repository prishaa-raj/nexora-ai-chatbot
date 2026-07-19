# AI-Powered Customer Support Chatbot (NEXORA)

A full-stack customer support chatbot: React + Tailwind frontend, FastAPI
backend, MongoDB for data, ChromaDB for vector search, and Gemini/OpenAI as
the LLM — with Retrieval-Augmented Generation (RAG) over your own uploaded
documents.

This guide assumes **zero prior setup** on your machine. Follow it top to
bottom in order.

---

## 1. Install the tools you need (one-time)

You need three things installed on your computer. Skip any you already have.

1. **Python 3.11+** — https://www.python.org/downloads/
   During install on Windows, tick **"Add Python to PATH"**.
   Check it worked: open a terminal and run `python --version`.

2. **Node.js 20+** — https://nodejs.org (choose the "LTS" version)
   Check it worked: `node --version` and `npm --version`.

3. **MongoDB Community Server** — https://www.mongodb.com/try/download/community
   During install, choose **"Install as a Service"** (Windows) so it starts
   automatically. On Mac, `brew install mongodb-community` and
   `brew services start mongodb-community` is easiest. On Linux, follow
   MongoDB's official apt/yum instructions for your distro.

   Alternative if you don't want to install MongoDB locally: create a free
   cluster at https://www.mongodb.com/cloud/atlas and use that connection
   string instead (step 3 below).

You do **not** need to install Docker for local development — that's an
optional shortcut covered in section 6.

---

## 2. Get an LLM API key

The chatbot needs at least one of these to actually generate answers (without
either, it still runs, but only ever returns a canned "no AI provider
configured" message):

- **Gemini (recommended, has a free tier):** https://aistudio.google.com/apikey
- **OpenAI:** https://platform.openai.com/api-keys

Copy whichever key(s) you get — you'll paste them into a file in the next step.

---

## 3. Backend setup

Open a terminal in the `backend/` folder.

```bash
cd backend

# Create an isolated Python environment (keeps this project's packages
# separate from everything else on your machine)
python -m venv venv

# Activate it -- you must do this every time you open a new terminal
# to work on this project:
#   Windows:      venv\Scripts\activate
#   Mac/Linux:    source venv/bin/activate

pip install -r requirements.txt
```

Now create your real config file:

```bash
# Windows: copy .env.example .env
# Mac/Linux:
cp .env.example .env
```

Open the new `.env` file in any text editor and fill in:

- `JWT_SECRET` — run `python -c "import secrets; print(secrets.token_hex(32))"`
  and paste the output here. This is your app's password-signing secret;
  keep it private and never share it or commit it to GitHub.
- `GEMINI_API_KEY` and/or `OPENAI_API_KEY` — paste the key(s) from step 2.
- `MONGO_URI` — leave as `mongodb://localhost:27017` if you installed MongoDB
  locally. If you used MongoDB Atlas instead, paste the connection string
  Atlas gave you here.

Everything else in `.env` can stay at its default for local development.

Start the backend:

```bash
uvicorn app.main:app --reload
```

Leave this terminal running. You should see something like
`Uvicorn running on http://127.0.0.1:8000`. Visit
http://localhost:8000/api/health in your browser — you should see
`{"status":"ok"}`. That means the backend is alive.

The first time it starts, it also **seeds demo data** automatically
(`SEED_DEMO_DATA=true` in `.env`), giving you two ready-to-use accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `admin123` |
| Customer | `user@example.com` | `user123` |

**Change or remove these before deploying anywhere real** — see section 7.

---

## 4. Frontend setup

Open a **second, separate terminal** (leave the backend terminal running) in
the `frontend/` folder.

```bash
cd frontend
npm install
npm run dev
```

Visit the URL it prints (usually http://localhost:5173). You should see the
login screen. Log in with either demo account from the table above.

That's it — you now have the full app running locally: frontend at
`:5173`, backend at `:8000`, talking to each other automatically (Vite's dev
server forwards `/api/...` calls to the backend for you — that's what
`vite.config.ts`'s `proxy` section does).

---

## 5. Try it out

1. Log in as `user@example.com` (customer view) and ask something like
   *"What's the warranty period?"* — it should answer using the 3 sample
   documents that were seeded automatically.
2. Log out, log back in as `admin@example.com` — you'll see the Admin
   Dashboard: upload your own PDF/FAQ documents (Knowledge Base tab), watch
   Analytics update, adjust the chatbot's name/system prompt (Settings tab).
3. Back in the customer view, try the **microphone icon** (voice input) and
   the **language dropdown** (multi-language support) if your browser
   supports the Web Speech API (Chrome/Edge do; Firefox's support is
   limited).

---

## 6. Optional: run everything with Docker instead

If you'd rather not install Python/Node/MongoDB individually, and you already
have **Docker Desktop** installed (https://www.docker.com/products/docker-desktop/):

```bash
# From the project root (where docker-compose.yml is)
cp backend/.env.example backend/.env
# edit backend/.env and fill in JWT_SECRET / GEMINI_API_KEY as in step 3

docker compose up --build
```

Visit http://localhost — that's the whole app (frontend on port 80, proxying
`/api` to the backend container, which talks to a MongoDB container). First
build takes a few minutes; after that, `docker compose up` is fast.

---

## 7. Before you submit / deploy this anywhere

Things that are **fine for local development and demoing to yourself**, but
you should genuinely do before a real deployment or a public demo:

1. **Change the seeded demo passwords**, or set `SEED_DEMO_DATA=false` in
   `.env` and create your own admin manually (see below).
2. **Generate a real `JWT_SECRET`** — never leave it as the placeholder. The
   app actually refuses to start if `ENVIRONMENT=production` and the secret
   is still the default, precisely so this can't be forgotten silently.
3. **Set `CORS_ORIGINS`** in `.env` to your real deployed frontend URL —
   never leave it as `*` or as `localhost` once this is live somewhere.
4. **Set `ENVIRONMENT=production`** in `.env` when you actually deploy —
   this turns on stricter security headers (HSTS) and the JWT-secret check
   above.

### How to create your first admin account manually (if you set `SEED_DEMO_DATA=false`)

Public registration can never create an admin account (this was a real
security hole in an earlier version of this project, fixed deliberately) — so
the very first admin has to be created some other way. Easiest option, with
your venv activated in `backend/`:

```bash
python -c "
import asyncio
from app.database import connect_to_mongo, users_col
from app.security import hash_password
import uuid
from datetime import datetime, timezone

async def main():
    connect_to_mongo()
    await users_col().insert_one({
        'id': f'user-{uuid.uuid4().hex[:12]}',
        'email': 'YOUR_EMAIL_HERE',
        'name': 'YOUR_NAME_HERE',
        'role': 'admin',
        'password_hash': hash_password('YOUR_PASSWORD_HERE'),
        'createdAt': datetime.now(timezone.utc).isoformat(),
    })
    print('Admin created.')

asyncio.run(main())
"
```

Edit the three `YOUR_..._HERE` placeholders first. After that, every
additional admin can be created safely from inside the app itself
(Admin Dashboard → Settings → Team Access), so you only ever need to do this
manual step once.

---

## 8. Running the backend test suite (optional but recommended)

```bash
cd backend
pip install -r requirements-dev.txt
pytest -v
```

No real MongoDB/API keys needed for this — the tests use an in-memory
database and mocked AI responses. See `backend/TESTING.md` for exactly what
is and isn't covered.

---

## Project structure

```
ai_chat_bot/
├── backend/                 FastAPI app
│   ├── app/
│   │   ├── main.py           entrypoint, middleware, security headers
│   │   ├── config.py         all settings, read from .env
│   │   ├── models.py         Pydantic request/response schemas
│   │   ├── database.py       MongoDB (Motor) connection
│   │   ├── security.py       password hashing + JWT
│   │   ├── deps.py           auth dependencies (get_current_user, require_admin)
│   │   ├── seed.py           demo-data seeding
│   │   ├── rate_limit.py     shared slowapi limiter
│   │   ├── rag/               chunking, embeddings, ChromaDB, LLM orchestration
│   │   └── routers/           auth, chat, documents, admin, notifications
│   ├── tests/                 pytest suite
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── .env.example
│   └── Dockerfile
├── frontend/                 React + Vite + Tailwind
│   ├── src/
│   │   ├── App.tsx            top-level auth/routing
│   │   ├── api.ts             fetch wrapper (attaches JWT, base URL)
│   │   ├── types.ts           shared TypeScript types
│   │   ├── index.css          design tokens (colors, fonts, status-light system)
│   │   └── components/        AuthScreen, CustomerPortal, AdminDashboard, StatusDot
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
└── docker-compose.yml        wires backend + frontend + MongoDB together
```

## Known gaps (be upfront about these if you're presenting this)

- **No password reset flow.** If a demo account's password is forgotten, an
  admin has to reset it directly in MongoDB for now.
- **PDF text extraction has no automated test** — it's exercised manually
  when you actually upload a PDF through the Admin Dashboard, but the test
  suite mocks it out (see `backend/TESTING.md`).
- **"Daily volume by status" in Analytics is an approximation.** Resolved/
  escalated counts per day are inferred from each conversation's last message
  timestamp, since there's no separate status-change history log. Good
  enough for a trend line, not perfectly precise event tracking.
- **Tests are written but I could not execute them myself** (see
  `backend/TESTING.md`) — run `pytest -v` yourself before relying on them for
  a demo.
