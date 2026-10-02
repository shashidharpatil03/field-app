import { useState, useEffect } from "react";
import { useT, useLanguage } from "./i18n.jsx";
import { apiFetch } from "./api.js";

// "2026-05-01" -> "1 May 2026" (or the Marathi form)
function showDate(iso, lang) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(
    lang === "mr" ? "mr-IN" : "en-IN",
    { day: "numeric", month: "long", year: "numeric" },
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

  function number(value) {
    return data ? value : "–";
  }

  return (
    <div>
      <div className="stats">
        <div className="stat">
          <div className="stat-number">{number(data?.participating)}</div>
          <div className="stat-label">{t("statParticipating")}</div>
        </div>
        <div className="stat">
          <div className="stat-number">{number(data?.growing_cotton)}</div>
          <div className="stat-label">{t("statGrowing")}</div>
        </div>
        <div className="stat">
          <div className="stat-number">{number(data?.women)}</div>
          <div className="stat-label">{t("statWomen")}</div>
          {data && (
            <div className="stat-sub">
              {t("statWomenShare", { pct: data.women_percent })}
            </div>
          )}
        </div>
        <div className="stat">
          <div className="stat-number">{number(data?.area_under_cotton)}</div>
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
          <div>
            <div className="stat-number">{number(data?.season.updated)}</div>
            <div className="stat-label">{t("seasonUpdated")}</div>
          </div>
          <div>
            <div className="stat-number">{number(data?.season.added)}</div>
            <div className="stat-label">{t("seasonAdded")}</div>
          </div>
          <div>
            <div className="stat-number">
              {number(data?.season.dropped_out)}
            </div>
            <div className="stat-label">{t("seasonDropped")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FarmerSummary;
