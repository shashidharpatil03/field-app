import { useState, useEffect } from "react";
import { useT } from "./i18n.jsx";
import { apiFetch } from "./api.js";
import { saveDashCache, readDashCache, formatWhen } from "./offline.js";
import FarmerNav from "./FarmerNav.jsx";
import FarmerSummary, { Hero } from "./FarmerSummary.jsx";
import ProgressTracker from "./ProgressTracker.jsx";

// The first screen of Farmer Data: the numbers, then how far the update of
// last season's farmers has got. With no signal it shows the numbers saved
// on the phone the last time, and says so.
function Dashboard({ nav, onOpen }) {
  const t = useT();
  // A copy saved by an older version of the app has different numbers in
  // it, so it is ignored.
  const cached = readDashCache();
  const saved = cached && cached.data && cached.data.this_year ? cached : null;
  const [data, setData] = useState(saved ? saved.data : null);
  // Set while we are showing the saved copy rather than fresh numbers.
  const [savedAt, setSavedAt] = useState(saved ? saved.savedAt : null);

  useEffect(() => {
    apiFetch("http://localhost:8000/farmers/dashboard")
      .then((response) => {
        if (!response.ok) {
          throw new Error("not ok");
        }
        return response.json();
      })
      .then((fresh) => {
        setData(fresh);
        setSavedAt(null);
        saveDashCache(fresh);
      })
      .catch(() => {
        // No signal: keep whatever is already on screen.
      });
  }, []);

  return (
    <div className="page">
      <FarmerNav active="dashboard" {...nav} />

      {savedAt && (
        <p className="offline-note">
          {t("dashSavedNote", { time: formatWhen(savedAt) })}
        </p>
      )}

      <Hero data={data} onOpen={onOpen} />
      {data && <ProgressTracker lastYear={data.last_year} onOpen={onOpen} />}
      <FarmerSummary data={data} onOpen={onOpen} />
    </div>
  );
}

export default Dashboard;
