import FarmerSummary from "./FarmerSummary.jsx";
import { useT } from "./i18n.jsx";
import { formatWhen } from "./offline.js";

// The first screen of Farmer Data: one compact row per learning group.
// Tapping a row opens the farmer list for that group.
function LearningGroups({
  lgs,
  isManager,
  savedCopyFrom,
  onHome,
  onOpen,
  onOpenAll,
}) {
  const t = useT();

  return (
    <div className="page">
      <button className="home-button" onClick={onHome}>
        ← {t("home")}
      </button>

      <FarmerSummary refreshKey={lgs} />

      <h1>{t("tabLgs")}</h1>

      {savedCopyFrom && (
        <p className="offline-note">
          {t("offlineNote", { time: formatWhen(savedCopyFrom) })}
        </p>
      )}

      <button onClick={onOpenAll}>{t("viewAllFarmers")}</button>

      <ul className="group-list">
        {lgs.map((lg) => (
          <li key={lg.id}>
            <button className="group-row" onClick={() => onOpen(lg)}>
              <span className="group-text">
                <span className="group-code">{lg.lg_code}</span>
                <small>
                  {lg.village} · {lg.farmer_count} {t("farmers")}
                </small>
                {isManager && (
                  <small>
                    {t("facilitator")} {lg.ff_name ?? t("nobodyYet")}
                  </small>
                )}
              </span>
              {lg.draft_count > 0 && (
                <span className="badge neutral">
                  {t("draftsBadge", { n: lg.draft_count })}
                </span>
              )}
              <span className="chevron" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default LearningGroups;
