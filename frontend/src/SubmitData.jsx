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
    // Every farmer of last year: the three statuses together. On the right,
    // and picked when Farmer Data opens.
    {
      key: "all",
      seasons: ["to_update", "continued", "dropped"],
      label: "allLastYear",
      count: "season_total",
      tone: "a",
    },
  ],
  this: [
    {
      key: "continued",
      season: "continued",
      label: "statusContinued",
      count: "season_continued",
      tone: "b",
    },
    {
      key: "new",
      season: "new",
      label: "statusNew",
      count: "new_count",
      tone: "g",
    },
    {
      key: "all",
      season: "this_year",
      label: "allThisYear",
      count: "season_farmers",
      tone: "a",
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
  // "All last year" and "All this year" are buttons too, so one is always
  // picked. A button can stand for more than one season filter.
  const current = buttons.find((b) => b.key === view.status) || buttons[buttons.length - 1];
  const seasonsOf = (b) => b.seasons || [b.season];
  const seasons = seasonsOf(current);
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
    async function loadAll(season) {
      const all = [];
      let total = 0;
      do {
        const params = new URLSearchParams();
        params.set("season", season);
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
    Promise.all(seasons.map(loadAll))
      .then((lists) => {
        // Always in farmer code order, whichever statuses were asked for.
        const all = lists.flat().sort((a, b) =>
          a.farmer_code.localeCompare(b.farmer_code),
        );
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
  }, [seasons.join(","), query, version, JSON.stringify(extra)]);

  // When the list is narrowed, the totals on the buttons are asked from the
  // server too, so they match what the list would show.
  useEffect(() => {
    if (!filtersOn) {
      return undefined;
    }
    let stale = false;
    Promise.all(
      buttons.map(async (b) => {
        let sum = 0;
        for (const season of seasonsOf(b)) {
          const params = new URLSearchParams();
          params.set("season", season);
          params.set("status", "all");
          narrowParams(params);
          params.set("limit", "1");
          const response = await apiFetch(
            `http://localhost:8000/farmers?${params.toString()}`,
          );
          const data = await response.json();
          sum += data.total;
        }
        return [b.key, sum];
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

  // Groups start folded; the ones the person opens are kept here.
  const open = view.open || {};
  const hasNumbers =
    lgs.length > 0 && typeof lgs[0].season_farmers === "number";

  function countFor(lg, button) {
    return lg[button.count] || 0;
  }

  // Total for a button, across all the groups this person can see.
  function totalFor(button) {
    return lgs.reduce((sum, lg) => sum + countFor(lg, button), 0);
  }

  // Each year lists the same groups under all three of its buttons, with 0
  // where nobody fits that button. Last year: the groups that had farmers
  // last year (this includes a group that was dropped, and leaves out a group
  // made this season). This year: every group that is not dropped, so a
  // farmer can be added to a group that has none yet. While searching or
  // filtering, only groups with a match.
  // Adding a farmer is only offered on "Newly added" and "Total this year".
  const addable = view.year === "this" && current.key !== "continued";
  const shown = lgs.filter((lg) => {
    if (query || filtersOn) {
      return farmers.some((f) => f.lg_id === lg.id);
    }
    if (view.year === "last") {
      return (lg.season_total || 0) > 0;
    }
    return !lg.dropped_on;
  });
  // While searching or filtering, the groups with a match are shown open.
  const forceOpen = !!query || filtersOn;
  const isOpen = (lg) => forceOpen || !!open[lg.id];
  const allOpen = shown.length > 0 && shown.every(isOpen);

  function toggleLg(id) {
    setView({ ...view, open: { ...open, [id]: !open[id] } });
  }

  function toggleAll() {
    if (allOpen) {
      setView({ ...view, open: {} });
    } else {
      const next = {};
      for (const lg of shown) {
        next[lg.id] = true;
      }
      setView({ ...view, open: next });
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
    setView({ ...view, year: year, status: "all", open: {} });
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

        <div className="seg">
          {buttons.map((b) => (
            <button
              key={b.key}
              className={`seg-b ${b.tone}${current.key === b.key ? " on" : ""}`}
              aria-pressed={current.key === b.key}
              onClick={() =>
                setView({
                  ...view,
                  status: current.key === b.key ? "all" : b.key,
                })
              }
            >
              <b>
                {filtersOn
                  ? (counts[b.key] ?? "–")
                  : hasNumbers
                    ? totalFor(b)
                    : "–"}
              </b>
              <span>{t(b.label)}</span>
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

      <div className="submit-search-wrap">
        <svg
          className="submit-search-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          className="submit-search"
          type="text"
          aria-label={t("searchLabel")}
          value={typed}
          placeholder={t("searchPlaceholder")}
          onChange={(e) => setTyped(e.target.value)}
        />
      </div>

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
            {allOpen ? `▲ ${t("collapseAll")}` : `▼ ${t("openAll")}`}
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
          const isOpened = isOpen(lg);
          const inLg = farmers.filter((f) => f.lg_id === lg.id);
          // The numbers under the group code, in the same order and colours
          // as the buttons on top. When one status is picked, the other
          // columns fade; with "All" picked nothing fades.
          const cols = buttons;
          return (
            <li
              key={lg.id}
              className={`sd-lg${lg.dropped_on ? " is-dropped" : lg.is_new ? " is-new" : ""}`}
            >
              {lg.dropped_on ? (
                <div className="sd-lg-strip">{t("lgDroppedStrip")}</div>
              ) : lg.is_new ? (
                <div className="sd-lg-strip">{t("lgNewStrip")}</div>
              ) : null}
              <button
                className="rm-head"
                aria-expanded={isOpened}
                onClick={() => toggleLg(lg.id)}
              >
                <span className="rm-tile" aria-hidden="true">
                  {String(parseInt(lg.lg_code.split("-").pop(), 10) || "")}
                </span>
                <span className="rm-head-text">
                  <span className="rm-head-name">{lg.lg_code}</span>
                  <span className="rm-head-code">
                    {lg.village}
                    {isManager && ` | ${lg.ff_name ?? t("nobodyYet")}`}
                  </span>
                </span>
                <span className="rm-arrow" aria-hidden="true">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={isOpened ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
                  </svg>
                </span>
              </button>
              <div className="rm-strip">
                {cols.map((c) => (
                  <div
                    key={c.key}
                    className={`rm-col ${c.tone}${current.key !== "all" && current.key !== c.key ? " dim" : ""}`}
                  >
                    <b>{lg[c.count] || 0}</b>
                    <span>{t(c.label)}</span>
                  </div>
                ))}
              </div>

              {isOpened && (
                <ul className="rm-farmers">
                  {inLg.map((f) => (
                    <li className="rm-row" key={f.id}>
                      <button
                        className="rm-main"
                        onClick={() => onOpenFarmer(f.id, false, !!lg.dropped_on)}
                      >
                        <span className="rm-name">{f.name}</span>
                        <span className="rm-code">{f.farmer_code}</span>
                        <span className={`rm-tag ${f.season_status}`}>
                          {t(
                            {
                              new: "statusNew",
                              continued: "statusContinued",
                              to_update: "statusToUpdate",
                              dropped: "droppedOut",
                            }[f.season_status] || "statusContinued",
                          )}
                        </span>
                        {f.pending && (
                          <small className="sd-wait">{t("waitingBadge")}</small>
                        )}
                      </button>
                      {f.season_status === "dropped" && !lg.dropped_on && (
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
                    <li className="sd-empty">
                      {query || filtersOn
                        ? t("noFarmers")
                        : t("noneUnderStatus")}
                    </li>
                  )}
                </ul>
              )}
              {isOpened && addable && !lg.dropped_on && (
                <button
                  className="sd-add-foot"
                  onClick={() => onRegister(lg, null)}
                >
                  ＋ {t("addFarmerTo", { code: lg.lg_code })}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default SubmitData;
