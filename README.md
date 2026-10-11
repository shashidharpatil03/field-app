# Co-farm Field Tools

A mobile-friendly app for collecting and maintaining **Farmer data** in the field. It works offline and sends its data by itself when there is signal.

All data in this repository is **made up**. There are no real farmers, no passwords, no keys.

How AI tools were used is described in [AI_USAGE.md](AI_USAGE.md).

---

## What the app does

**Farmer Data** module was chosen for this practical assessment. 

> A field facilitator (FF) registers new farmers, updates last season's farmers, reviews and sends the data, and can see what was sent. Everything keeps working with no signal and sends itself when the signal returns. A Producer Unit Manager can add or drop an LG; add or drop an FF; shift LGs from one FF to another. It also shows dashboard for FFs and PUMs to track data collection progress and use the data they collect.

### For the field facilitator

| Screen | What it does |
| --- | --- |
| **Farmer Data → Dashboard** | Farmer counts for last season and this season (new, continued, still to update, dropped out), with progress and filters by village, group and facilitator. |
| **Farmer Data → Submit Data** | Opens on **Total last year**: every farmer from last season under their learning group, each tagged *Still to update*, *Continued* or *Dropped out*. One bar of four numbers filters the list; the **2026-27** tab shows *Continued*, *Newly added* and **Total this year**. Groups start folded, farmers sorted by farmer code, with a search box. *Add farmer* appears only under *Newly added* and *Total this year*. |
| **Farmer details** | **One screen for every farmer**, whatever their status: the details first, then big buttons at the bottom that depend on the status. *Still to update*: **Review and confirm details** or **Dropped out**. *Continued*: **Change details** or **Dropped out**. *Newly added*: **Change details** or **Delete farmer**. *Dropped out*: **Bring back and review details**. Farmers of a dropped group are shown read-only. |
| **Register / Edit farmer** | A few questions per screen (name, then gender and mobile, then land and cotton), then a **final check** where any answer can be changed before saving. A *Still to update* farmer must go through every answer; there is no "all correct" shortcut. Checks happen on each screen and again on the server. |
| **Incomplete** | Saved drafts. Start a registration, stop, come back later. |
| **Sent** | Everything already sent, with the time it reached the server. |
| **Ready to send** | Changes made without signal, waiting to go. Shows anything the server refused, with the reason. |
| **Language** | English and Marathi |

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
- Farmers of a **dropped learning group** cannot be changed or continued. The screen shows them read-only and the server refuses the change too.
- A *Still to update* farmer is only counted as updated after the facilitator has gone through every answer and saved. A dropped farmer brought back goes through the same review.
- Every change is written to an **activity log** (who, what, when). Deleted farmers are archived, not erased.

---

## Tech stack

| Part | Choice |
| --- | --- |
| Frontend | React 19 + Vite, plain JavaScript |
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
5. If the phone cannot reach the page on your Wi-Fi (some routers stop devices on Wi-Fi from talking to each other), turn on the laptop's **Mobile hotspot**, join it from the phone, and use the laptop's hotspot address (usually `http://192.168.137.1:4173`). This worked when the router blocked the connection.

### Existing database from an earlier version

You do not need these for a fresh install. The `backend/add_*.py` files are one-off migrations that bring an **older** `field.db` up to date without losing data. Each is safe to run more than once.

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
    SubmitData.jsx   farmer list: year tabs, status bar, folded groups
    FarmerProfile.jsx the one details screen and its bottom buttons
    EditFarmer.jsx   review / change flow (three screens and a final check)
    DropFarmer.jsx, DeleteFarmer.jsx, RegisterFarmer.jsx  drop, delete, add
```

---

## Known limitations

- **No real sign-in.** The sign-in screen is a picker of made-up users and the server trusts an `X-User-Id` header. Fine for a demo, not for production. A real version needs proper authentication (for example one-time codes by SMS) and per-user tokens.
- **Personal data on the phone.** The offline copy holds farmer names and mobile numbers. A lost phone is a risk, larger for a PU manager (all groups). A real version needs a device lock requirement, encryption and a way to wipe the copy remotely.
- **Moved groups.** If the manager moves a group away from a facilitator while that facilitator is offline, their waiting edits for that group are refused at sync and shown with a reason.
- **First sign-in on a phone needs signal**, to download the first data copy.
- **Whole-copy sync.** The phone downloads everything it is allowed to see each time. Fine for hundreds of farmers, not for tens of thousands. A real version would send only what changed.
- **Admin work is online only** by design.
- **Not covered:** other modules (Farm, Sowing, Practice Adoption, Capacity Strengthening, RIR), which appear as "coming soon" tiles; photos and GPS; data export for analysts beyond the SQLite tables themselves.
- **No automated tests yet.** Rules were checked by hand and with throwaway scripts.

## What I would do next
1. A field test with real users on low-end phones. It will also be an opportunity to review data collection workflows
2. PU Manager data verification workflow needs to be added.
3. One shared rules definition for server and browser, instead of two copies.
4. Real authentication and device security
5. More modules (RIR, Practice Adoption) on the same offline layer.


