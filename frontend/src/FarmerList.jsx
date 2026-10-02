import { useState, useEffect } from "react";
import { useT } from "./i18n.jsx";
import { apiFetch } from "./api.js";
import { PhoneIcon } from "./icons.jsx";
import FarmerNav from "./FarmerNav.jsx";

const PAGE_SIZE = 40;

// "Suresh Patil" -> "SP"
function initials(name) {
  return name
    .split(" ")
    .filter((word) => word !== "")
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

// The farmer list with filters. The filters live in the parent
// (FarmerData), so they are still set when you come back from a profile.
function FarmerList({
  lgs,
  filters,
  setFilters,
  isManager,
  message,
  nav,
  onOpenFarmer,
  onRegister,
  onChanged,
}) {
  const t = useT();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [version, setVersion] = useState(0);
  const [typed, setTyped] = useState(filters.q);
  const [picking, setPicking] = useState(false);
  const [localMessage, setLocalMessage] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [drafts, setDrafts] = useState([]);

  // ---- choices for the filter drop-downs, taken from the group list ----
  const villages = [];
  const facilitators = [];
  for (const lg of lgs) {
    if (lg.village_id && !villages.some((v) => v.id === lg.village_id)) {
      villages.push({ id: lg.village_id, name: lg.village });
    }
    if (lg.ff_id && !facilitators.some((f) => f.id === lg.ff_id)) {
      facilitators.push({ id: lg.ff_id, name: lg.ff_name });
    }
  }
  villages.sort((a, b) => a.name.localeCompare(b.name));
  facilitators.sort((a, b) => a.name.localeCompare(b.name));

  function fitsFilters(lg, next) {
    return (
      (next.villageId === "" || String(lg.village_id) === next.villageId) &&
      (next.ffId === "" || String(lg.ff_id) === next.ffId)
    );
  }
  const lgChoices = lgs.filter((lg) => fitsFilters(lg, filters));
  const selectedLg = lgs.find((lg) => String(lg.id) === filters.lgId) || null;

  function changeFilter(name, value) {
    const next = { ...filters, [name]: value };
    // Keep the group choice only if it still fits the village / facilitator.
    if (name === "villageId" || name === "ffId") {
      const current = lgs.find((lg) => String(lg.id) === next.lgId);
      if (current && !fitsFilters(current, next)) {
        next.lgId = "";
      }
    }
    setFilters(next);
  }

  // Search as the person types, but wait a moment so we do not ask the
  // server after every single letter.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typed !== filters.q) {
        setFilters({ ...filters, q: typed });
      }
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed]);

  // Forget the open History / Drafts panels when the group changes.
  useEffect(() => {
    setHistoryOpen(false);
    setDraftsOpen(false);
    setPicking(false);
  }, [filters.lgId]);

  function buildUrl(offset) {
    const params = new URLSearchParams();
    if (filters.lgId) params.set("lg_id", filters.lgId);
    if (filters.villageId) params.set("village_id", filters.villageId);
    if (filters.ffId) params.set("ff_id", filters.ffId);
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (filters.gender) params.set("gender", filters.gender);
    if (filters.growing) params.set("growing", filters.growing);
    if (filters.water) params.set("water", filters.water);
    if (filters.season) params.set("season", filters.season);
    params.set("status", filters.status);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));
    return `http://localhost:8000/farmers?${params.toString()}`;
  }

  // First page: runs again whenever a filter changes.
  useEffect(() => {
    let stale = false;
    setLoading(true);
    setLoadError(false);
    apiFetch(buildUrl(0))
      .then((response) => {
        if (!response.ok) {
          throw new Error("not ok");
        }
        return response.json();
      })
      .then((data) => {
        if (!stale) {
          setItems(data.items);
          setTotal(data.total);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!stale) {
          setLoadError(true);
          setLoading(false);
        }
      });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.lgId,
    filters.villageId,
    filters.ffId,
    filters.q,
    filters.status,
    filters.gender,
    filters.growing,
    filters.water,
    filters.season,
    version,
  ]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const response = await apiFetch(buildUrl(items.length));
      if (response.ok) {
        const data = await response.json();
        setItems([...items, ...data.items]);
        setTotal(data.total);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    }
    setLoadingMore(false);
  }

  function reload() {
    setVersion(version + 1);
    onChanged();
  }

  // ---- History and Drafts of the chosen group ----
  async function toggleHistory() {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    try {
      const response = await apiFetch(
        `http://localhost:8000/lgs/${selectedLg.id}/assignments`,
      );
      if (response.ok) {
        setHistory(await response.json());
        setHistoryOpen(true);
      }
    } catch {
      setLoadError(true);
    }
  }

  async function loadDrafts() {
    const response = await apiFetch(
      `http://localhost:8000/lgs/${selectedLg.id}/drafts`,
    );
    if (response.ok) {
      setDrafts(await response.json());
    }
  }

  async function toggleDrafts() {
    if (draftsOpen) {
      setDraftsOpen(false);
      return;
    }
    try {
      await loadDrafts();
      setDraftsOpen(true);
    } catch {
      setLoadError(true);
    }
  }

  async function deleteDraft(draftId) {
    try {
      await apiFetch(`http://localhost:8000/drafts/${draftId}`, {
        method: "DELETE",
      });
      await loadDrafts();
      onChanged();
    } catch {
      setLoadError(true);
    }
  }

  // ---- registering ----
  function handleRegister() {
    if (selectedLg) {
      onRegister(selectedLg, null);
    } else {
      setPicking(true);
    }
  }

  // ---- choosing several farmers ----
  // One label for where the farmer stands this season.
  function chip(f) {
    const labels = {
      new: ["continuing", t("statusNew")],
      continued: ["continuing", t("statusContinued")],
      to_update: ["todo", t("statusToUpdate")],
      dropped: ["dropped_out", t("droppedOut")],
      deleted: ["neutral", t("statusDeleted")],
    };
    const found = labels[f.season_status];
    if (found) {
      return <span className={`badge ${found[0]}`}>{found[1]}</span>;
    }
    if (f.participation === "dropped_out") {
      return <span className="badge dropped_out">{t("droppedOut")}</span>;
    }
    return <span className="badge continuing">{t("statusContinuing")}</span>;
  }

  const filtersActive =
    filters.lgId !== "" ||
    filters.villageId !== "" ||
    filters.ffId !== "" ||
    filters.q !== "" ||
    filters.status !== "continuing" ||
    filters.gender !== "" ||
    filters.growing !== "" ||
    filters.water !== "" ||
    filters.season !== "";

  function clearFilters() {
    setTyped("");
    setFilters({
      villageId: "",
      lgId: "",
      ffId: "",
      q: "",
      status: "continuing",
      gender: "",
      growing: "",
      water: "",
      season: "",
    });
  }

  // The filters that came from tapping a dashboard figure, shown as chips
  // that can each be removed.
  const chips = [];
  if (filters.gender) {
    chips.push({ name: "gender", text: t(`chipGender_${filters.gender}`) });
  }
  if (filters.growing) {
    chips.push({ name: "growing", text: t(`chipGrowing_${filters.growing}`) });
  }
  if (filters.water) {
    chips.push({
      name: "water",
      text: t(`chipWater_${filters.water.replace(" ", "_")}`),
    });
  }
  if (filters.season) {
    chips.push({ name: "season", text: t(`seasonFilter_${filters.season}`) });
  }

  return (
    <div className="page">
      <FarmerNav active="farmers" {...nav} />
      <h1>{t("farmersTitle")}</h1>

      {message && <p className="message">{message}</p>}
      {localMessage && <p className="message">{localMessage}</p>}

      {chips.length > 0 && (
        <div className="chips">
          {chips.map((chipItem) => (
            <button
              key={chipItem.name}
              className="filter-chip"
              aria-label={`${chipItem.text}. ${t("removeFilter")}`}
              onClick={() => changeFilter(chipItem.name, "")}
            >
              {chipItem.text} <span aria-hidden="true">✕</span>
            </button>
          ))}
        </div>
      )}

      <div className="filters">
        <div className="field filter-wide">
          <label htmlFor="search">{t("searchLabel")}</label>
          <input
            id="search"
            type="text"
            value={typed}
            placeholder={t("searchPlaceholder")}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="f-village">{t("filterVillage")}</label>
          <select
            id="f-village"
            value={filters.villageId}
            onChange={(e) => changeFilter("villageId", e.target.value)}
          >
            <option value="">{t("allVillages")}</option>
            {villages.map((v) => (
              <option key={v.id} value={String(v.id)}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="f-lg">{t("filterGroup")}</label>
          <select
            id="f-lg"
            value={filters.lgId}
            onChange={(e) => changeFilter("lgId", e.target.value)}
          >
            <option value="">{t("allGroups")}</option>
            {lgChoices.map((lg) => (
              <option key={lg.id} value={String(lg.id)}>
                {lg.lg_code}
              </option>
            ))}
          </select>
        </div>

        {isManager && (
          <div className="field">
            <label htmlFor="f-ff">{t("filterFf")}</label>
            <select
              id="f-ff"
              value={filters.ffId}
              onChange={(e) => changeFilter("ffId", e.target.value)}
            >
              <option value="">{t("allFfs")}</option>
              {facilitators.map((f) => (
                <option key={f.id} value={String(f.id)}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label htmlFor="f-status">{t("statusLabel")}</label>
          <select
            id="f-status"
            value={filters.status}
            disabled={filters.season !== ""}
            onChange={(e) => {
              // Choosing a status replaces any season filter.
              setFilters({ ...filters, status: e.target.value, season: "" });
            }}
          >
            <option value="continuing">{t("statusContinuing")}</option>
            <option value="dropped_out">{t("droppedOut")}</option>
            <option value="all">{t("statusAll")}</option>
            <option value="deleted">{t("statusDeleted")}</option>
          </select>
        </div>
      </div>

      {filtersActive && (
        <button className="link-button" onClick={clearFilters}>
          {t("clearFilters")}
        </button>
      )}

      {selectedLg && (
        <div className="card">
          <h3>{selectedLg.lg_code}</h3>
          <p>
            {selectedLg.village} · {selectedLg.farmer_count} {t("farmers")}
          </p>
          <p>
            {t("facilitator")} {selectedLg.ff_name ?? t("nobodyYet")}
          </p>
          <button onClick={toggleHistory}>
            {historyOpen ? t("hideHistory") : t("history")}
          </button>
          {selectedLg.draft_count > 0 && (
            <button onClick={toggleDrafts}>
              {draftsOpen
                ? t("hideDrafts")
                : t("drafts", { n: selectedLg.draft_count })}
            </button>
          )}

          {historyOpen && (
            <div className="history">
              {history.map((h) => (
                <p key={h.id}>
                  <strong>{h.ff_name}</strong>
                  <br />
                  {h.start_date} {t("to")} {h.end_date ?? t("now")}
                </p>
              ))}
            </div>
          )}

          {draftsOpen && (
            <ul className="drafts">
              {drafts.map((d) => (
                <li key={d.id}>
                  <strong>{d.name || t("unnamedFarmer")}</strong>
                  <br />
                  <small>
                    {t("saved")} {d.updated_at.replace("T", " ")}
                  </small>
                  <br />
                  <button onClick={() => onRegister(selectedLg, d)}>
                    {t("continue")}
                  </button>
                  <button onClick={() => deleteDraft(d.id)}>
                    {t("delete")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button className="primary" onClick={handleRegister}>
        {t("registerFarmer")}
      </button>

      {picking && (
        <div className="field pick-group">
          <label htmlFor="pick-lg">{t("chooseGroupToRegister")}</label>
          <select
            id="pick-lg"
            value=""
            onChange={(e) => {
              const lg = lgs.find((x) => String(x.id) === e.target.value);
              if (lg) {
                onRegister(lg, null);
              }
            }}
          >
            <option value="">{t("chooseGroupOption")}</option>
            {lgChoices.map((lg) => (
              <option key={lg.id} value={String(lg.id)}>
                {lg.lg_code} · {lg.village}
              </option>
            ))}
          </select>
        </div>
      )}

      {loadError && (
        <div className="offline-note">
          <p>{t("listOffline")}</p>
          <button onClick={() => setVersion(version + 1)}>
            {t("tryAgain")}
          </button>
        </div>
      )}

      {!loadError && (
        <p className="count-line">
          {loading
            ? t("loading")
            : t("showingCount", { shown: items.length, total: total })}
        </p>
      )}

      {!loading && !loadError && items.length === 0 && (
        <p className="message">{t("noFarmers")}</p>
      )}

      <ul className="farmer-list">
        {items.map((f) => (
          <li className="farmer-row" key={f.id}>
            <div>
              <button
                className="farmer-main"
                disabled={f.season_status === "deleted"}
                onClick={() => onOpenFarmer(f.id)}
              >
                <span className="avatar small" aria-hidden="true">
                  {initials(f.name)}
                </span>
                <span className="farmer-text">
                  <strong>{f.name}</strong>
                  <small>{f.farmer_code}</small>
                </span>
                {chip(f)}
              </button>
              {f.season_status === "deleted" ? (
                <span className="no-mobile">
                  {f.deleted_on} · {f.reason}
                </span>
              ) : f.mobile ? (
                <a
                  className="call"
                  href={`tel:${f.mobile}`}
                  aria-label={t("callFarmer", { name: f.name })}
                >
                  <PhoneIcon /> {f.mobile}
                </a>
              ) : (
                <span className="no-mobile">{t("noMobile")}</span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!loadError && items.length < total && (
        <button onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? t("loading") : t("loadMore")}
        </button>
      )}
    </div>
  );
}

export default FarmerList;
