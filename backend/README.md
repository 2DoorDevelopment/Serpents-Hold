# ⬡ SERPENT'S HOLD — Underground Market (FastAPI Backend)

A Star Citizen themed peer-to-peer marketplace with a Python/FastAPI backend.

---

## Setup

### 1. Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and set strong values for JWT_SECRET and SETUP_SECRET
```

To load the `.env` file, either use `python-dotenv` or export vars manually:
```bash
export JWT_SECRET="your-long-secret-here"
export SETUP_SECRET="your-setup-secret"
```

### 3. Start the server

```bash
uvicorn main:app --reload --port 3000
```

The app will be live at **http://localhost:3000**

Interactive API docs are available at **http://localhost:3000/api/docs**

---

## Making Your First Admin

1. Register an account normally at the site
2. Run this curl to promote yourself:

```bash
curl -X POST http://localhost:3000/api/setup-admin \
  -H "Content-Type: application/json" \
  -d '{"username": "YourUsername", "secret": "your-setup-secret"}'
```

3. Log out and back in — the Admin nav link will appear.

---

## RSI Verification Flow

1. Go to **Profile → RSI Link**
2. Enter your RSI handle (e.g. `BoredGamer`)
3. Click **Generate Verification Code** — get a code like `SC-VERIFY-A3F2B1C0`
4. Paste that code anywhere in your RSI bio at `robertsspaceindustries.com/account/profile`
5. Save your RSI bio, then click **Verify Now**
6. The server uses `httpx` + `BeautifulSoup` to scrape your citizen page and confirm the code

---

## Project Structure

```
starcitizen-market/
├── backend/                   ← Python/FastAPI
│   ├── main.py                # App entry, router registration, static file serving
│   ├── database.py            # SQLite schema & connection helper
│   ├── auth.py                # JWT, password hashing, FastAPI dependencies
│   ├── requirements.txt
│   ├── .env.example
│   ├── routers/
│   │   ├── auth.py            # Register, login, profile, RSI verify
│   │   ├── listings.py        # CRUD + image upload + filtering
│   │   ├── messages.py        # Inbox, sent, reply
│   │   ├── admin.py           # Admin panel endpoints
│   │   └── reports.py         # User reports
│   └── uploads/               # Uploaded images (auto-created)
└── frontend/                  ← Vanilla JS SPA (unchanged)
    ├── index.html
    ├── css/main.css
    └── js/
        ├── api.js
        ├── pages.js
        └── modals.js
```

---

## Tech Stack

- **Backend**: Python · FastAPI · SQLite (stdlib) · passlib/bcrypt · python-jose (JWT) · httpx · BeautifulSoup4
- **Frontend**: Vanilla JS SPA
- **Fonts**: Orbitron · Rajdhani · Share Tech Mono
