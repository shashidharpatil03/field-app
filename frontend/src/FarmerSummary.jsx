import { useState, useEffect, useRef } from "react";
import { useT, useLanguage } from "./i18n.jsx";
import { apiFetch } from "./api.js";

// "2026-05-01" -> "1 May 2026" (or the Marathi form)
function showDate(iso, lang) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(
    lang === "mr" ? "mr-IN" : "en-IN",
    { day: "numeric", month: "long", year: "numeric" },
  );
}

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

// refreshKey changes whenever the screen below has reloaded its data,
// which makes this summary fetch fresh numbers too.
function FarmerSummary({ refreshKey }) {
  const t = useT();
  const { lang } = useLanguage();
  const [data, setData] = useState(null);

  useEffect(() => {
    apiFetch("http://localhost:8000/farmers/dashboard")
      .then((response) => response.json())
      .then((result) => setData(result))
      .catch(() => {
        // No signal: keep showing the last numbers (or dashes).
      });
  }, [refreshKey]);

  const growingPercent =
    data && data.participating > 0
      ? Math.round((100 * data.growing_cotton) / data.participating)
      : 0;

  return (
    <div>
      <div className="stats">
        <div className="stat">
          <div className="stat-number">
            <Num value={data?.participating} />
          </div>
          <div className="stat-label">{t("statParticipating")}</div>
        </div>
        <div className="stat">
          <div className="stat-number">
            <Num value={data?.growing_cotton} />
          </div>
          <div className="stat-label">{t("statGrowing")}</div>
          {data && (
            <div>
              <div className="bar" aria-hidden="true">
                <div
                  className="bar-fill"
                  style={{ width: `${growingPercent}%` }}
                />
              </div>
              <div className="stat-sub">
                {t("statShare", { pct: growingPercent })}
              </div>
            </div>
          )}
        </div>
        <div className="stat">
          <div className="stat-top">
            <div className="stat-number">
              <Num value={data?.women} />
            </div>
            {data && <Ring percent={data.women_percent} />}
          </div>
          <div className="stat-label">{t("statWomen")}</div>
          {data && (
            <div className="stat-sub">
              {t("statShare", { pct: data.women_percent })}
            </div>
          )}
        </div>
        <div className="stat">
          <div className="stat-number">
            <Num value={data?.area_under_cotton} decimals={1} />
          </div>
          <div className="stat-label">{t("statArea")}</div>
        </div>
      </div>

      <div className="season-box">
        <h3>{t("seasonTitle")}</h3>
        {data && (
          <p className="season-since">
            {t("seasonSince", { date: showDate(data.season.start, lang) })}
          </p>
        )}
        <div className="season-numbers">
          <div className="s-updated">
            <div className="stat-number">
              <Num value={data?.season.updated} />
            </div>
            <div className="stat-label">{t("seasonUpdated")}</div>
          </div>
          <div className="s-added">
            <div className="stat-number">
              <Num value={data?.season.added} />
            </div>
            <div className="stat-label">{t("seasonAdded")}</div>
          </div>
          <div className="s-dropped">
            <div className="stat-number">
              <Num value={data?.season.dropped_out} />
            </div>
            <div className="stat-label">{t("seasonDropped")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FarmerSummary;
