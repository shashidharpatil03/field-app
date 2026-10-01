import { useState, useEffect } from "react";
import { useT } from "./i18n.jsx";
import { apiFetch } from "./api.js";

// refreshKey changes whenever the screen below has reloaded its data,
// which makes this summary fetch fresh numbers too.
function FarmerSummary({ refreshKey }) {
  const t = useT();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    apiFetch("http://localhost:8000/farmers/summary")
      .then((response) => response.json())
      .then((data) => setSummary(data));
  }, [refreshKey]);

  return (
    <div className="stats">
      <div className="stat">
        <div className="stat-number">{summary ? summary.continuing : "–"}</div>
        <div className="stat-label">{t("statContinuing")}</div>
      </div>
      <div className="stat">
        <div className="stat-number">
          {summary ? summary.growing_cotton : "–"}
        </div>
        <div className="stat-label">{t("statGrowing")}</div>
      </div>
    </div>
  );
}

export default FarmerSummary;
