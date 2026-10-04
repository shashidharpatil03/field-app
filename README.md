# Co-farm Field Tools

A mobile-friendly app for collecting and maintaining **farmer profile data** in the field. It works with or without a phone signal. Built as a practical assessment: a small, well-finished slice of a MyBCIData (CommCare) style workflow, not a full replacement.

All data in this repository is **made up**. There are no real farmers, no passwords, no keys.

---

## What the app does

**Module chosen: Farmer Profile (Farmer Data).** The journey it supports end to end:

> A Producer Unit (PU) manager sets up Learning Groups (LGs) and facilitators. A field facilitator (FF) registers new farmers, updates last season's farmers, reviews and sends the data, and can see what was sent. Everything keeps working with no signal and sends itself when the signal returns.

### For the field facilitator

| Screen | What it does |
| --- | --- |
| **Farmer Data → Dashboard** | Farmer counts for last season and this season (new, continued, still to update, dropped out), with progress and filters by village, group and facilitator. |
| **Farmer Data → Submit Data** | Learning groups and their farmers. Update last season's farmers, register new ones, drop or bring back a farmer, delete a farmer registered by mistake. |
| **Register / Edit farmer** | Step-by-step form with a **Review** step before saving. Checks happen as the person types and again on the server. |
| **Incomplete** | Saved drafts. Start a registration, stop, come back later. |
| **Sent** | Everything already sent, with the time it reached the server. |
| **Waiting to be sent (Data sync)** | Changes made without signal, waiting to go. Shows anything the server refused, with the reason. |
| **Language** | English and Marathi (newest screens not yet reviewed by a native speaker). |

### For the PU manager

Everything above for all facilitators in the PU, plus **PU Management** (online only): add, drop, delete and bring back learning groups, add facilitators, mark a facilitator as left, and move groups from one facilitator to another (one group or several at a time).

### Data points collected per farmer

| Data point | Rule enforced |
| --- | --- |
| First name, middle name, last name | First and last required. Letters and spaces only. At most 30 letters each, 60 in total. |
| Gender | Required. |
| Mobile number | Optional. Exactly 10 digits. Must be unique, so the same farmer cannot be registered twice. |
| Growing cotton this season | Required. If "No", cotton area is set to 0 automatically (skip logic). |
| Total landholding (acres) | Required. More than 0 and at most 100, with at most 2 decimals. Above 50 asks the user to confirm. |
| Area under cotton (acres) | Required when growing cotton, and then more than 0. Cannot be more than total landholding. Same range and confirmation rules. |
| Water regime | Rainfed, Partially irrigated or Fully irrigated. |
| Learning group, village, facilitator, registration date and time, who registered | Filled in by the system. |

### Business rules built in

- Only the PU manager can add, drop, delete or bring back an LG. LG numbers are **never reused**.
- Facilitator codes (for example `INMH01FF5`) are **never reused**.
- A facilitator can drop out and bring back farmers. A farmer registered this season can only be **deleted**, not dropped.
- Season status is worked out from the data: *Newly added*, *Continued*, *Still to update*, *Dropped out*, *Deleted*. The season starts on 1 May.
- If the manager and a facilitator both change the same farmer, **the latest change wins**.
- Once a facilitator is marked as left, they can no longer use the app.
- Every change is written to an **activity log** (who, what, when). Deleted farmers are archived, not erased.

---

## Tech stack

| Part | Choice |
| --- | --- |
| Frontend | React 19 + Vite, plain JavaScript, no UI library, hand-written CSS |
| Backend | Python, FastAPI, the standard `sqlite3` module (no ORM) |
| Database | SQLite (`backend/field.db`, created locally, not committed) |
| Offline | Service worker (app shell), IndexedDB (data copy on the phone), localStorage (waiting list) |
| Languages | English, Marathi |

---

## How to run it locally

You need **Python 3.10+** and a current **Node.js** (LTS). Open two terminals.

### 1. Backend

```
cd backend
pip install -r requirements.txt
python setup_db.py
python -m uvicorn main:app --reload
```

`setup_db.py` builds a fresh database with made-up data (2 PUs, 4 facilitators, 6 learning groups, 210 farmers, 2 PU managers). Running it again **resets** the database. The API runs on http://localhost:8000 (interactive docs at http://localhost:8000/docs).

### 2. Frontend

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and pick a user on the sign-in screen: either a PU manager or one of the facilitators. There is no password; see *Known limitations*. Use a phone-sized browser window (browser dev tools → device toolbar) to see it as a facilitator would.

### Trying offline mode

The service worker only runs in a built copy, not in `npm run dev`.

```
cd frontend
npm run build
npm run preview
```

Open http://localhost:4173, sign in **while online** and open the lists once. Then in the browser's dev tools choose *Network → Offline* (or switch off Wi-Fi) and reload. The app opens, shows the farmers, and lets you register, edit, drop and delete. The chip at the top shows how many changes are waiting. Go back online and they send by themselves; the **Sent** screen then shows the time each reached the server.

Stop any older `npm run preview` first. If it starts on port 4174 instead of 4173, the backend will refuse it (see CORS in `backend/main.py`).

### Trying it on a real phone (same Wi-Fi)

1. Start the backend with `python -m uvicorn main:app --reload --host 0.0.0.0`.
2. Start the frontend with `npm run preview -- --host` and note your laptop's IP address.
3. Open `http://<laptop-ip>:4173` on the phone.
4. A service worker needs https. For a plain-http test on Android Chrome, enable `chrome://flags/#unsafe-treat-insecure-origin-as-secure` and add `http://<laptop-ip>:4173`. A real deployment would use https and does not need this.

### Existing database from an earlier version

You do not need these for a fresh install. The `backend/add_*.py` files are one-off migrations that bring an **older** `field.db` up to date without losing data. Each is safe to run more than once.

---

## How offline works

The idea: **work offline where the work happens in the field; check online where a change affects other people.**

1. **App shell.** A service worker saves the app's own files, so it opens with no signal.
2. **Data copy.** After sign-in the app downloads a copy of the user's data from `GET /sync/snapshot` and keeps it in IndexedDB, one copy per user. Lists, the dashboard and farmer profiles are answered from this copy (`localQuery.js`, `localData.js`).
3. **Writing.** A change is sent to the server first so validation is immediate. If the network fails, it goes onto a **waiting list** instead (`pending_<userId>` in localStorage).
4. **What the user sees.** Waiting changes are laid on top of the saved copy (`overlay.js`), so the screens already show them. Local-only records have negative IDs until the server gives real ones.
5. **Sending.** When the app thinks it is online it first pings the server (a phone can be "online" with no real connection), then sends the waiting changes one by one. The server checks each again. A refused change stays on the Sync screen with its reason, and does not block the others.
6. **Refresh.** After sending, a fresh copy is fetched. The view is frozen during this so numbers do not jump.
7. **Admin actions** (PU Management) need the server on purpose: they affect other people's lists, so they say "needs an internet connection" instead of queuing.

Season-status rules are repeated in the browser (`localQuery.js`) so counts match the server. This duplication is the main cost of the design; see *What I would do next*.

---

## Project layout

```
backend/
  main.py          the API (all endpoints, validation, audit trail)
  setup_db.py      builds a fresh made-up database
  demo_data.py     made-up data helpers
  land_rules.py    land-area rules, kept separate so they are easy to test
  name_parts.py    name rules
  users_seed.py    made-up sign-in users
  add_*.py         one-off migrations for older databases
frontend/
  public/sw.js     service worker
  src/             React screens and the offline layer
    api.js           every request goes through here (adds the user, decides local vs server)
    snapshotStore.js saved data copy on the phone (IndexedDB)
    localQuery.js    answers list/dashboard/profile questions from that copy
    overlay.js       lays waiting changes on top of the copy
    offline.js       waiting list, sending, sync state
    i18n.jsx         English and Marathi text
    farmerRules.js   form checks (the server checks again)
```

---

## Known limitations

- **No real sign-in.** The sign-in screen is a picker of made-up users and the server trusts an `X-User-Id` header. Fine for a demo, not for production. A real version needs proper authentication (for example one-time codes by SMS) and per-user tokens.
- **Personal data on the phone.** The offline copy holds farmer names and mobile numbers. A lost phone is a risk, larger for a PU manager (all groups). A real version needs a device lock requirement, encryption and a way to wipe the copy remotely.
- **Rare duplicate on a lost reply.** If a registration reaches the server but the reply is lost, it can be sent twice. The unique mobile number catches most of these. The fix is a client-generated unique ID per submission.
- **Moved groups.** If the manager moves a group away from a facilitator while that facilitator is offline, their waiting edits for that group are refused at sync and shown with a reason.
- **First sign-in on a phone needs signal**, to download the first data copy.
- **Whole-copy sync.** The phone downloads everything it is allowed to see each time. Fine for hundreds of farmers, not for tens of thousands. A real version would send only what changed.
- **Sent** shows only what has reached the server.
- **Admin work is online only** by design.
- **Marathi** for the newest screens was written with AI help and has not been reviewed by a native speaker.
- **Not covered:** other modules (Farm, Sowing, Practice Adoption, Capacity Strengthening, RIR), which appear as "coming soon" tiles; photos and GPS; data export for analysts beyond the SQLite tables themselves.
- **No automated tests yet.** Rules were checked by hand and with throwaway scripts.

## What I would do next

1. Automated tests for the rules (land, names, season status) and for the sync rules.
2. Unique ID per submission, so a lost reply can never create a duplicate.
3. One shared rules definition for server and browser, instead of two copies.
4. Real authentication, device security, and https deployment.
5. Delta sync, then more modules (Farm, Practice Adoption) on the same offline layer.
6. Review of the Marathi text with facilitators, and a field test with real users on low-end phones.
