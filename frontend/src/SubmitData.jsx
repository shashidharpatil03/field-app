import { useState, useEffect } from "react";
import { useT } from "./i18n.jsx";
import { apiFetch } from "./api.js";
import { PhoneIcon } from "./icons.jsx";
import FarmerNav from "./FarmerNav.jsx";
import { formatWhen } from "./offline.js";

const PAGE_SIZE = 100;

// "2026-27": the season runs from 1 May.
function seasonLabel() {
  const today = new Date();
  const start =
    today.getMonth() >= 4 ? today.getFullYear() : today.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

// The status buttons under each of the two year buttons. `season` is the
// filter the server understands; `count` says which number on a learning
// group holds how many farmers there are; `tone` picks the colour.
const BUTTONS = {
  last: [
    {
      key: "to_update",
      season: "to_update",
      label: "statusToUpdate",
      count: "to_update_count",
      tone: "o",
    },
    {
      key: "continued",
      season: "continued",
      label: "statusContinued",
      count: "season_continued",
      tone: "b",
    },
    {
      key: "dropped",
      season: "dropped",
      label: "droppedOut",
      count: "season_dropped",
      tone: "s",
    },
  ],
  this: [
    {
      key: "new",
      season: "new",
      label: "statusNew",
      count: "new_count",
      tone: "g",
    },
    {
      key: "continued",
      season: "continued",
      label: "statusContinued",
      count: "season_continued",
      tone: "b",
    },
    {
      key: "all",
      season: "this_year",
      label: "allThisYear",
      count: "season_farmers",
      tone: "v",
    },
  ],
};

// The first screen of Farmer Data. Pick last year's or this year's
// farmers, pick a status, and see the farmers under their learning group.
// `view` (which year, which status, which groups are folded) is kept in
// FarmerData so it is still the same when you come back from a profile.
function SubmitData({
  lgs,
  isManager,
  savedCopyFrom,
  view,
  setView,
  message,
  nav,
  onOpenFarmer,
  onRegister,
}) {
  const t = useT();
  const buttons = BUTTONS[view.year];
  const current = buttons.find((b) => b.key === view.status) || buttons[0];
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [version, setVersion] = useState(0);
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  // Numbers for the three buttons when the list is narrowed down.
  const [counts, setCounts] = useState({});
  const extra = view.filters;
  const filtersOn = Object.values(extra).some((v) => v !== "");

  // The parameters every request to the server shares: the search text and
  // whatever was picked on the dashboard.
  function narrowParams(params) {
    if (query) params.set("q", query);
    if (extra.lgId) params.set("lg_id", extra.lgId);
    if (extra.villageId) params.set("village_id", extra.villageId);
    if (extra.ffId) params.set("ff_id", extra.ffId);
    if (extra.gender) params.set("gender", extra.gender);
    if (extra.growing) params.set("growing", extra.growing);
    if (extra.water) params.set("water", extra.water);
  }

  // Wait a moment after typing so the server is not asked after every letter.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(typed.trim()), 350);
    return () => clearTimeout(timer);
  }, [typed]);

  // Gets every farmer for the chosen button, one page of 100 at a time.
  useEffect(() => {
    let stale = false;
    setLoading(true);
    setLoadError(false);
    async function loadAll() {
      const all = [];
      let total = 0;
      do {
        const params = new URLSearchParams();
        params.set("season", current.season);
        params.set("status", "all");
        narrowParams(params);
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(all.length));
        const response = await apiFetch(
          `http://localhost:8000/farmers?${params.toString()}`,
        );
        if (!response.ok) {
          throw new Error("not ok");
        }
        const data = await response.json();
        total = data.total;
        all.push(...data.items);
        if (data.items.length === 0) {
          break;
        }
      } while (all.length < total);
      return all;
    }
    loadAll()
      .then((all) => {
        if (!stale) {
          setFarmers(all);
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
  }, [current.season, query, version, JSON.stringify(extra)]);

  // When the list is narrowed, the totals on the buttons are asked from the
  // server too, so they match what the list would show.
  useEffect(() => {
    if (!filtersOn) {
      return undefined;
    }
    let stale = false;
    Promise.all(
      buttons.map(async (b) => {
        const params = new URLSearchParams();
        params.set("season", b.season);
        params.set("status", "all");
        narrowParams(params);
        params.set("limit", "1");
        const response = await apiFetch(
          `http://localhost:8000/farmers?${params.toString()}`,
        );
        const data = await response.json();
        return [b.key, data.total];
      }),
    )
      .then((pairs) => {
        if (!stale) {
          setCounts(Object.fromEntries(pairs));
        }
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.year, query, version, JSON.stringify(extra)]);

  const closed = view.closed;
  const hasNumbers =
    lgs.length > 0 && typeof lgs[0].season_farmers === "number";

  function countFor(lg, button) {
    return lg[button.count] || 0;
  }

  // Total for a button, across all the groups this person can see.
  function totalFor(button) {
    return lgs.reduce((sum, lg) => sum + countFor(lg, button), 0);
  }

  // Last year's view lists only groups that have somebody under the chosen
  // button. This year's lists every group, so a farmer can be added to a
  // group that has none yet. While searching, only groups with a match.
  const addable = view.year === "this" && current.key === "new";
  const shown = lgs.filter((lg) => {
    if (query || filtersOn) {
      return farmers.some((f) => f.lg_id === lg.id);
    }
    // Only "Newly added" lists every group, so a farmer can be added to a
    // group that has nobody new yet.
    return addable || countFor(lg, current) > 0;
  });
  const allClosed = shown.length > 0 && shown.every((lg) => closed[lg.id]);

  function toggleLg(id) {
    setView({ ...view, closed: { ...closed, [id]: !closed[id] } });
  }

  function toggleAll() {
    if (allClosed) {
      setView({ ...view, closed: {} });
    } else {
      const next = {};
      for (const lg of shown) {
        next[lg.id] = true;
      }
      setView({ ...view, closed: next });
    }
  }

  // The choices picked on the dashboard, shown as chips that can be removed.
  const chips = [];
  const lgPicked = lgs.find((lg) => String(lg.id) === extra.lgId);
  const villagePicked = lgs.find(
    (lg) => String(lg.village_id) === extra.villageId,
  );
  const ffPicked = lgs.find((lg) => String(lg.ff_id) === extra.ffId);
  if (extra.villageId) {
    chips.push({ name: "villageId", text: villagePicked?.village ?? "" });
  }
  if (extra.lgId) {
    chips.push({ name: "lgId", text: lgPicked?.lg_code ?? "" });
  }
  if (extra.ffId) {
    chips.push({ name: "ffId", text: ffPicked?.ff_name ?? "" });
  }
  if (extra.gender) {
    chips.push({ name: "gender", text: t(`chipGender_${extra.gender}`) });
  }
  if (extra.growing) {
    chips.push({ name: "growing", text: t(`chipGrowing_${extra.growing}`) });
  }
  if (extra.water) {
    chips.push({
      name: "water",
      text: t(`chipWater_${extra.water.replace(" ", "_")}`),
    });
  }

  function removeChip(name) {
    setView({ ...view, filters: { ...extra, [name]: "" } });
  }

  function chooseYear(year) {
    setView({ ...view, year: year, status: BUTTONS[year][0].key });
  }

  return (
    <div className="page">
      <FarmerNav active="submit" {...nav}>
        <div className="ftoggle" role="group">
          <button
            className={view.year === "last" ? "on" : ""}
            aria-pressed={view.year === "last"}
            onClick={() => chooseYear("last")}
          >
            {t("lastYearShort")}
          </button>
          <button
            className={view.year === "this" ? "on" : ""}
            aria-pressed={view.year === "this"}
            onClick={() => chooseYear("this")}
          >
            {seasonLabel()}
          </button>
        </div>

        <div className="fstats">
          {buttons.map((b) => (
            <button
              key={b.key}
              className={`${b.tone}${current.key === b.key ? " on" : ""}`}
              aria-pressed={current.key === b.key}
              onClick={() => setView({ ...view, status: b.key })}
            >
              <b>
                {filtersOn
                  ? (counts[b.key] ?? "–")
                  : hasNumbers
                    ? totalFor(b)
                    : "–"}
              </b>
              {t(b.label)}
            </button>
          ))}
        </div>
      </FarmerNav>

      {message && <p className="message">{message}</p>}

      {savedCopyFrom && (
        <p className="offline-note">
          {t("offlineNote", { time: formatWhen(savedCopyFrom) })}
        </p>
      )}

      <input
        className="submit-search"
        type="text"
        aria-label={t("searchLabel")}
        value={typed}
        placeholder={t("searchPlaceholder")}
        onChange={(e) => setTyped(e.target.value)}
      />

      {chips.length > 0 && (
        <div className="chips">
          {chips.map((c) => (
            <button
              key={c.name}
              className="filter-chip"
              aria-label={`${c.text}. ${t("removeFilter")}`}
              onClick={() => removeChip(c.name)}
            >
              {c.text} <span aria-hidden="true">✕</span>
            </button>
          ))}
        </div>
      )}

      <div className="lg-bar">
        <strong>{t("lgsHeading")}</strong>
        {shown.length > 0 && (
          <button className="lg-toggle-all" onClick={toggleAll}>
            {allClosed ? `▼ ${t("openAll")}` : `▲ ${t("collapseAll")}`}
          </button>
        )}
      </div>

      {loadError && (
        <div className="offline-note">
          <p>{t("listOffline")}</p>
          <button onClick={() => setVersion(version + 1)}>
            {t("tryAgain")}
          </button>
        </div>
      )}

      {loading && !loadError && <p className="count-line">{t("loading")}</p>}

      {!loading && !loadError && shown.length === 0 && (
        <p className="message">{t("noFarmers")}</p>
      )}

      <ul className="submit-lgs">
        {shown.map((lg) => {
          const isClosed = !!closed[lg.id];
          const inLg = farmers.filter((f) => f.lg_id === lg.id);
          return (
            <li key={lg.id} className="sd-lg">
              <div className="sd-lg-head">
                <button
                  className="sd-lg-main"
                  aria-expanded={!isClosed}
                  onClick={() => toggleLg(lg.id)}
                >
                  <span className="sd-chevron" aria-hidden="true">
                    {isClosed ? "▶" : "▼"}
                  </span>
                  <span className="sd-lg-text">
                    <span className="sd-lg-code">{lg.lg_code}</span>
                    <span className="sd-lg-sub">
                      {lg.village}
                      {isManager && ` | ${lg.ff_name ?? t("nobodyYet")}`}
                    </span>
                  </span>
                </button>
                {addable && (
                  <button
                    className="sd-add"
                    onClick={() => onRegister(lg, null)}
                  >
                    ＋ {t("addFarmerShort")}
                  </button>
                )}
                <span className={`sd-count ${current.tone}`}>
                  {query ? inLg.length : countFor(lg, current)}
                </span>
              </div>

              {!isClosed && (
                <ul className="sd-farmers">
                  {inLg.map((f) => (
                    <li className={`sd-row st-${f.season_status}`} key={f.id}>
                      <button
                        className="sd-code"
                        onClick={() => onOpenFarmer(f.id)}
                      >
                        {f.farmer_code}
                      </button>
                      <button
                        className="sd-name"
                        onClick={() => onOpenFarmer(f.id)}
                      >
                        {f.name}
                      </button>
                      {f.season_status === "dropped" && (
                        <button
                          className="sd-bring"
                          title={t("bringBack")}
                          aria-label={t("bringBack")}
                          onClick={() => onOpenFarmer(f.id, true)}
                        >
                          ↩
                        </button>
                      )}
                      {f.mobile && (
                        <a
                          className="sd-call"
                          href={`tel:${f.mobile}`}
                          aria-label={t("callFarmer", { name: f.name })}
                        >
                          <PhoneIcon />
                        </a>
                      )}
                    </li>
                  ))}
                  {!loading && inLg.length === 0 && (
                    <li className="sd-empty">{t("noFarmers")}</li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default SubmitData;
