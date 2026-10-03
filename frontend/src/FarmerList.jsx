import { useState, useEffect } from "react";
import { useT } from "./i18n.jsx";
import { apiFetch } from "./api.js";
import { PhoneIcon, FilterIcon } from "./icons.jsx";
import FarmerNav from "./FarmerNav.jsx";

const PAGE_SIZE = 40;

// "2026-27": the season runs from 1 May.
function seasonLabel() {
  const today = new Date();
  const start =
    today.getMonth() >= 4 ? today.getFullYear() : today.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

// The four continuity buttons under the search bar, in this order. The
// value is the "season" filter the server understands.
const CONTINUITY = [
  { value: "continued", label: "statusContinued", tone: "green" },
  { value: "new", label: "statusNew", tone: "green" },
  { value: "dropped", label: "droppedOut", tone: "tan" },
  { value: "to_update", label: "statusToUpdate", tone: "red" },
];

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
  const [filterOpen, setFilterOpen] = useState(false);
  const [localMessage, setLocalMessage] = useState("");

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

  // Forget the "choose a group" box when the group filter changes.
  useEffect(() => {
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
      new: ["fnew", t("statusNew")],
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
    filters.status !== "all" ||
    filters.gender !== "" ||
    filters.growing !== "" ||
    filters.water !== "" ||
    filters.season !== "";

  // The icon turns dark green while something chosen inside the pop-up is on.
  const popupFiltersOn =
    filters.lgId !== "" ||
    filters.villageId !== "" ||
    filters.ffId !== "" ||
    filters.status === "deleted";

  function clearFilters() {
    setTyped("");
    setFilters({
      villageId: "",
      lgId: "",
      ffId: "",
      q: "",
      status: "all",
      gender: "",
      growing: "",
      water: "",
      season: "",
    });
  }

  // The selected continuity buttons. Several can be on at once; none on
  // means "All".
  const selectedKeys =
    filters.season === ""
      ? []
      : filters.season === "this_year"
        ? ["continued", "new"]
        : filters.season.split(",");
  // "Farmers (2026-27)" is the same as Continued + Newly added together.
  const thisSeasonOn =
    selectedKeys.length === 2 &&
    selectedKeys.includes("continued") &&
    selectedKeys.includes("new");

  function toggleContinuity(value) {
    const next = selectedKeys.includes(value)
      ? selectedKeys.filter((k) => k !== value)
      : [...selectedKeys, value];
    setFilters({ ...filters, status: "all", season: next.join(",") });
  }

  // The filters that came from tapping a dashboard figure, shown as chips
  // that can each be removed.
  const chips = [];
  if (selectedLg) {
    chips.push({ name: "lgId", text: selectedLg.lg_code });
  }
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

  return (
    <div className="page">
      <FarmerNav active="dashboard" {...nav} />
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

      <div className="search-row">
        <input
          id="search"
          type="text"
          aria-label={t("searchLabel")}
          value={typed}
          placeholder={t("searchPlaceholder")}
          onChange={(e) => setTyped(e.target.value)}
        />
        <button
          className={`filter-icon${popupFiltersOn ? " on" : ""}`}
          aria-label={t("filtersTitle")}
          onClick={() => setFilterOpen(true)}
        >
          <FilterIcon />
        </button>
      </div>

      <div className="cont-buttons">
        <button
          className={`cont-btn all${
            selectedKeys.length === 0 && filters.status !== "deleted"
              ? " sel"
              : ""
          }`}
          aria-pressed={selectedKeys.length === 0}
          disabled={filters.status === "deleted"}
          onClick={() => setFilters({ ...filters, status: "all", season: "" })}
        >
          {t("statusAll")}
        </button>
        <button
          className={`cont-btn all farmers${thisSeasonOn ? " sel" : ""}`}
          aria-pressed={thisSeasonOn}
          disabled={filters.status === "deleted"}
          onClick={() =>
            setFilters({
              ...filters,
              status: "all",
              season: thisSeasonOn ? "" : "continued,new",
            })
          }
        >
          {t("farmersSeason", { season: seasonLabel() })}
        </button>
        {CONTINUITY.map((c) => (
          <button
            key={c.value}
            className={`cont-btn ${c.tone}${
              selectedKeys.includes(c.value) ? " sel" : ""
            } k-${c.value}`}
            aria-pressed={selectedKeys.includes(c.value)}
            disabled={filters.status === "deleted"}
            onClick={() => toggleContinuity(c.value)}
          >
            {t(c.label)}
          </button>
        ))}
      </div>

      {filtersActive && (
        <button className="link-button" onClick={clearFilters}>
          {t("clearFilters")}
        </button>
      )}

      {filterOpen && (
        <div className="sheet-back" onClick={() => setFilterOpen(false)}>
          <div
            className="sheet"
            role="dialog"
            aria-label={t("filtersTitle")}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{t("filtersTitle")}</h2>
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
            <label className="check-line">
              <input
                type="checkbox"
                checked={filters.status === "deleted"}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    status: e.target.checked ? "deleted" : "all",
                    season: "",
                  })
                }
              />
              {t("showDeletedOnly")}
            </label>
            <div className="sheet-buttons">
              <button onClick={clearFilters}>{t("clearFilters")}</button>
              <button className="primary" onClick={() => setFilterOpen(false)}>
                {t("showNFarmers", { n: total })}
              </button>
            </div>
          </div>
        </div>
      )}

      <button className="primary" onClick={handleRegister}>
        {t("addNewFarmer")}
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
            <div className={`st-${f.season_status}`}>
              <button
                className="frow-top"
                disabled={f.season_status === "deleted"}
                onClick={() => onOpenFarmer(f.id)}
              >
                <span className="frow-code">{f.farmer_code}</span>
                <strong>{f.name}</strong>
              </button>
              <div className="frow-bottom">
                <button
                  className="frow-open"
                  disabled={f.season_status === "deleted"}
                  onClick={() => onOpenFarmer(f.id)}
                >
                  <span className="frow-village">{f.village}</span>
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
