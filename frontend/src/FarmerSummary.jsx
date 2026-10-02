import { useState, useEffect, useRef } from "react";
import { useT } from "./i18n.jsx";

// A number that counts up to its value (a short 0.5 second animation).
// Phones set to "reduce motion" get the number straight away.
function Num({ value, decimals = 0 }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (typeof value !== "number") {
      return undefined;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) {
      from.current = value;
      setShown(value);
      return undefined;
    }
    const begin = from.current;
    const startedAt = performance.now();
    let frame = 0;
    function step(now) {
      const progress = Math.min((now - startedAt) / 500, 1);
      const eased = 1 - (1 - progress) ** 3;
      setShown(begin + (value - begin) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        from.current = value;
      }
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return typeof value === "number" ? shown.toFixed(decimals) : "–";
}

// A circle that is filled to `percent`.
function Ring({ percent }) {
  const radius = 22;
  const length = 2 * Math.PI * radius;
  return (
    <svg className="ring" viewBox="0 0 56 56" aria-hidden="true">
      <circle className="ring-back" cx="28" cy="28" r={radius} />
      <circle
        className="ring-front"
        cx="28"
        cy="28"
        r={radius}
        strokeDasharray={length}
        strokeDashoffset={length * (1 - percent / 100)}
      />
    </svg>
  );
}

// The numbers at the top of the dashboard.
// The big green card is the number of farmers this season: farmers
// continued from last year plus newly added ones. Under it, a button shows
// how many of last year's farmers are still to be updated. The figures
// below cover only this season's farmers (continued + new); each card
// except the area is a button that opens exactly those farmers.
// onOpen(filters) is given the filters to apply.
export function Hero({ data, onOpen }) {
  const t = useT();
  const year = data?.this_year;
  const last = data?.last_year;

  return (
    <div>
      <div className="hero">
        <button
          className="hero-top"
          onClick={() => onOpen({ season: "this_year" })}
        >
          <span className="hero-label">
            {t("heroLabel", { season: data ? data.season.label : "" })}
          </span>
          <span className="hero-number">
            <Num value={year?.total} />
          </span>
          {year && (
            <span className="hero-sub">
              {t("heroSub", { continued: year.continued, added: year.new })}
            </span>
          )}
        </button>
        {last &&
          (last.to_update > 0 ? (
            <button
              className="hero-todo"
              onClick={() => onOpen({ season: "to_update" })}
            >
              <span>
                <b>{last.to_update}</b> {t("heroTodo")}
              </span>
              <span className="chev" aria-hidden="true">
                ›
              </span>
            </button>
          ) : (
            last.total > 0 && <p className="hero-done">{t("heroAllDone")}</p>
          ))}
      </div>
    </div>
  );
}

// The figures about this season's farmers (continued + new).
function FarmerSummary({ data, onOpen }) {
  const t = useT();
  const year = data?.this_year;

  const growingPercent =
    year && year.total > 0
      ? Math.round((100 * year.growing_cotton) / year.total)
      : 0;

  return (
    <div>
      <h2 className="section-h">{t("thisYearTitle")}</h2>
      <p className="section-note">{t("thisYearNote")}</p>
      <div className="stats">
        <button
          className="stat stat-button"
          onClick={() => onOpen({ growing: "yes", season: "this_year" })}
        >
          <span className="stat-number">
            <Num value={year?.growing_cotton} />
          </span>
          <span className="stat-label">{t("statGrowing")}</span>
          {year && (
            <span className="stat-extra">
              <span className="bar" aria-hidden="true">
                <span
                  className="bar-fill"
                  style={{ width: `${growingPercent}%` }}
                />
              </span>
              <span className="stat-sub">
                {t("statShare", { pct: growingPercent })}
              </span>
            </span>
          )}
        </button>
        <button
          className="stat stat-button"
          onClick={() => onOpen({ gender: "Female", season: "this_year" })}
        >
          <span className="stat-top">
            <span className="stat-number">
              <Num value={year?.women} />
            </span>
            {year && <Ring percent={year.women_percent} />}
          </span>
          <span className="stat-label">{t("statWomen")}</span>
          {year && (
            <span className="stat-sub">
              {t("statShare", { pct: year.women_percent })}
            </span>
          )}
        </button>
        <div className="stat stat-wide">
          <div className="stat-number">
            <Num value={year?.area_under_cotton} decimals={1} />
          </div>
          <div className="stat-label">{t("statArea")}</div>
        </div>
      </div>
    </div>
  );
}

export default FarmerSummary;
