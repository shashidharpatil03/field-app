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
function Dashboard({ nav, onOpen, lgs = [], isManager = false }) {
  const t = useT();
  // A copy saved by an older version of the app has different numbers in
  // it, so it is ignored.
  const cached = readDashCache();
  const saved =
    cached && cached.data && cached.data.this_year?.water ? cached : null;
  const [data, setData] = useState(saved ? saved.data : null);
  // Set while we are showing the saved copy rather than fresh numbers.
  const [savedAt, setSavedAt] = useState(saved ? saved.savedAt : null);
  // "" means all; otherwise the numbers are for that village, group or
  // facilitator.
  const [villageId, setVillageId] = useState("");
  const [lgId, setLgId] = useState("");
  const [ffId, setFfId] = useState("");
  const anyFilter = villageId !== "" || lgId !== "" || ffId !== "";
  const [filterOpen, setFilterOpen] = useState(false);

  function clearAll() {
    setVillageId("");
    setLgId("");
    setFfId("");
  }

  // Choices for the drop-downs come from the group list. Each choice narrows
  // the others.
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
  const lgChoices = lgs.filter(
    (lg) =>
      (villageId === "" || String(lg.village_id) === villageId) &&
      (ffId === "" || String(lg.ff_id) === ffId),
  );

  // One short line saying what the numbers are for, e.g. "Kheda · LG-03".
  const summary = [
    villages.find((v) => String(v.id) === villageId)?.name,
    lgs.find((lg) => String(lg.id) === lgId)?.lg_code,
    facilitators.find((f) => String(f.id) === ffId)?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  function chooseVillage(value) {
    setVillageId(value);
    dropGroupIfNotFitting(value, ffId);
  }

  function chooseFf(value) {
    setFfId(value);
    dropGroupIfNotFitting(villageId, value);
  }

  // Forget the chosen group if it is not in the new village / facilitator.
  function dropGroupIfNotFitting(village, ff) {
    const current = lgs.find((lg) => String(lg.id) === lgId);
    if (
      current &&
      ((village !== "" && String(current.village_id) !== village) ||
        (ff !== "" && String(current.ff_id) !== ff))
    ) {
      setLgId("");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams();
    if (villageId !== "") params.set("village_id", villageId);
    if (lgId !== "") params.set("lg_id", lgId);
    if (ffId !== "") params.set("ff_id", ffId);
    const text = params.toString();
    const query = text === "" ? "" : `?${text}`;
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
        // Only the unfiltered numbers are kept for use without signal.
        if (!anyFilter) {
          saveDashCache(fresh);
        }
      })
      .catch(() => {
        // No signal: keep whatever is already on screen.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villageId, lgId, ffId]);

  // Tapping a figure opens the farmer list with the same village, group and
  // facilitator chosen here.
  function openWithGroup(filters) {
    onOpen({ ...filters, villageId, lgId, ffId });
  }

  return (
    <div className="page">
      <FarmerNav active="dashboard" {...nav} />

      {savedAt && (
        <p className="offline-note">
          {t("dashSavedNote", { time: formatWhen(savedAt) })}
        </p>
      )}

      <button className="dash-filter-row" onClick={() => setFilterOpen(true)}>
        <strong>{summary || t("allGroups")}</strong>
        <span>{t("filtersTitle")} ▾</span>
      </button>

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
              <label htmlFor="dash-village">{t("filterVillage")}</label>
              <select
                id="dash-village"
                value={villageId}
                onChange={(e) => chooseVillage(e.target.value)}
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
              <label htmlFor="dash-lg">{t("filterGroup")}</label>
              <select
                id="dash-lg"
                value={lgId}
                onChange={(e) => setLgId(e.target.value)}
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
                <label htmlFor="dash-ff">{t("filterFf")}</label>
                <select
                  id="dash-ff"
                  value={ffId}
                  onChange={(e) => chooseFf(e.target.value)}
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
            <div className="sheet-buttons">
              {anyFilter && (
                <button onClick={clearAll}>{t("clearFilters")}</button>
              )}
              <button className="primary" onClick={() => setFilterOpen(false)}>
                {t("done")}
              </button>
            </div>
          </div>
        </div>
      )}

      <FarmersCard data={data} onOpen={openWithGroup} />
      <FarmerSummary data={data} onOpen={openWithGroup} />
    </div>
  );
}

export default Dashboard;
