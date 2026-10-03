import { useState, useEffect } from "react";
import { useT } from "./i18n.jsx";
import { apiFetch } from "./api.js";
import {
  dayHeading,
  weekHeading,
  weekStart,
  todayText,
  timeOf,
  formsText,
} from "./sentHelpers.js";

const FLAGS = {
  new: ["fnew", "statusNew"],
  continued: ["continuing", "statusContinued"],
  to_update: ["todo", "statusToUpdate"],
  dropped: ["dropped_out", "droppedOut"],
};

// The forms submitted this season, newest first, grouped by day or by week
// with the number of forms for each. Tapping a farmer opens the profile.
function Sent({ onHome, onOpenFarmer, isManager }) {
  const t = useT();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);
  const [view, setView] = useState("day");
  const [open, setOpen] = useState({});

  useEffect(() => {
    let stale = false;
    apiFetch("http://localhost:8000/sent")
      .then((response) => {
        if (!response.ok) {
          throw new Error("not ok");
        }
        return response.json();
      })
      .then((data) => {
        if (!stale) {
          setItems(data);
        }
      })
      .catch(() => {
        if (!stale) {
          setError(true);
        }
      });
    return () => {
      stale = true;
    };
  }, []);

  const list = items || [];
  const today = todayText();
  const thisWeek = weekStart(today);
  const todayCount = list.filter((f) => f.sent_on === today).length;
  const weekCount = list.filter((f) => weekStart(f.sent_on) >= thisWeek).length;

  // Group by day or by week; the list is already newest first.
  const groups = [];
  for (const item of list) {
    const key = view === "day" ? item.sent_on : weekStart(item.sent_on);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key: key, items: [item] });
    }
  }

  function isOpen(group, index) {
    const saved = open[`${view}-${group.key}`];
    return saved === undefined ? index === 0 : saved;
  }

  function toggle(group, index) {
    setOpen({ ...open, [`${view}-${group.key}`]: !isOpen(group, index) });
  }

  return (
    <div className="page">
      <button className="home-button" onClick={onHome}>
        ← {t("back")}
      </button>
      <p className="section-note">{t("sentNote")}</p>

      {error && <p className="offline-note">{t("listOffline")}</p>}
      {!error && items === null && <p className="count-line">{t("loading")}</p>}

      {items !== null && (
        <div className="sent-summary">
          <span>
            {t("sentToday")}: <b>{todayCount}</b>
          </span>
          <span>
            {t("sentThisWeek")}: <b>{weekCount}</b>
          </span>
        </div>
      )}

      <div className="seg">
        {["day", "week"].map((v) => (
          <button
            key={v}
            className={view === v ? "on" : ""}
            aria-pressed={view === v}
            onClick={() => setView(v)}
          >
            {v === "day" ? t("sentDay") : t("sentWeek")}
          </button>
        ))}
      </div>

      {items !== null && items.length === 0 && (
        <p className="message">{t("sentEmpty")}</p>
      )}

      {groups.map((group, index) => (
        <div key={`${view}-${group.key}`}>
          <button
            className="group-head"
            aria-expanded={isOpen(group, index)}
            onClick={() => toggle(group, index)}
          >
            <span>
              {view === "day"
                ? dayHeading(group.key, t)
                : weekHeading(group.key, t)}
            </span>
            <span className="group-count">
              {formsText(group.items.length, t)}
            </span>
            <span className="group-arrow">
              {isOpen(group, index) ? "▾" : "▸"}
            </span>
          </button>
          {isOpen(group, index) && (
            <ul className="farmer-list">
              {group.items.map((f) => {
                const flag = FLAGS[f.season_status] || FLAGS.dropped;
                const time = timeOf(f.sent_at, f.sent_on);
                const extra = [
                  f.village,
                  view === "week" ? dayHeading(f.sent_on, t) : null,
                  time,
                  isManager && f.by_name
                    ? t("sentBy", { name: f.by_name })
                    : null,
                ].filter(Boolean);
                return (
                  <li className="farmer-row" key={`${f.id}-${f.sent_on}`}>
                    <div className={`st-${f.season_status}`}>
                      <button
                        className="frow-top"
                        onClick={() => onOpenFarmer(f.id)}
                      >
                        <span className="frow-code">{f.farmer_code}</span>
                        <strong>{f.name}</strong>
                      </button>
                      <div className="frow-bottom">
                        <span className="frow-village">
                          {extra.join(" · ")}
                        </span>
                        <span className={`badge ${flag[0]}`}>{t(flag[1])}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export default Sent;
