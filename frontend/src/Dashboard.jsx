import { useState, useEffect } from "react";
import { useT } from "./i18n.jsx";
import { apiFetch } from "./api.js";
import { saveDashCache, readDashCache, formatWhen } from "./offline.js";
import FarmerNav from "./FarmerNav.jsx";
import FarmersCard from "./FarmersCard.jsx";
import FarmerSummary from "./FarmerSummary.jsx";

// The first screen of Farmer Data: the numbers, then how far the update of
// last season's farmers has got. With no signal it shows the numbers saved
// on the phone the last time, and says so.
function Dashboard({ nav, onOpen, lgs = [] }) {
  const t = useT();
  // A copy saved by an older version of the app has different numbers in
  // it, so it is ignored.
  const cached = readDashCache();
  const saved =
    cached && cached.data && cached.data.this_year?.water ? cached : null;
  const [data, setData] = useState(saved ? saved.data : null);
  // Set while we are showing the saved copy rather than fresh numbers.
  const [savedAt, setSavedAt] = useState(saved ? saved.savedAt : null);
  // "" means all learning groups; otherwise the numbers are for that group.
  const [lgId, setLgId] = useState("");

  useEffect(() => {
    const query = lgId === "" ? "" : `?lg_id=${lgId}`;
    apiFetch(`http://localhost:8000/farmers/dashboard${query}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("not ok");
        }
        return response.json();
      })
      .then((fresh) => {
        setData(fresh);
        setSavedAt(null);
        // Only the all-groups numbers are kept for use without signal.
        if (lgId === "") {
          saveDashCache(fresh);
        }
      })
      .catch(() => {
        // No signal: keep whatever is already on screen.
      });
  }, [lgId]);

  // Tapping a figure opens the farmer list, for the same group if one is
  // chosen here.
  function openWithGroup(filters) {
    onOpen(lgId === "" ? filters : { ...filters, lgId: lgId });
  }

  return (
    <div className="page">
      <FarmerNav active="dashboard" {...nav} />

      {savedAt && (
        <p className="offline-note">
          {t("dashSavedNote", { time: formatWhen(savedAt) })}
        </p>
      )}

      <div className="field dash-filter">
        <label htmlFor="dash-lg">{t("dashGroup")}</label>
        <select
          id="dash-lg"
          value={lgId}
          onChange={(e) => setLgId(e.target.value)}
        >
          <option value="">{t("allGroups")}</option>
          {lgs.map((lg) => (
            <option key={lg.id} value={String(lg.id)}>
              {lg.lg_code} · {lg.village}
            </option>
          ))}
        </select>
      </div>

      <FarmersCard data={data} onOpen={openWithGroup} />
      <FarmerSummary data={data} onOpen={openWithGroup} />
    </div>
  );
}

export default Dashboard;
