import { useEffect, useRef } from "react";
import FarmerSummary from "./FarmerSummary.jsx";
import FarmerNav from "./FarmerNav.jsx";
import { useT } from "./i18n.jsx";
import { formatWhen } from "./offline.js";

// The first screen of Farmer Data: one compact row per learning group.
// Tapping a row opens the farmer list for that group.
function LearningGroups({
  lgs,
  isManager,
  savedCopyFrom,
  nav,
  scrollSignal,
  onOpen,
}) {
  const t = useT();
  const listTop = useRef(null);

  // The "LGs" button asks us to scroll down to the group list.
  useEffect(() => {
    if (scrollSignal > 0 && listTop.current) {
      listTop.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [scrollSignal]);

  return (
    <div className="page">
      <FarmerNav active="lgs" {...nav} />

      <FarmerSummary refreshKey={lgs} />

      <h1 ref={listTop} className="scroll-target">
        {t("tabLgs")}
      </h1>

      {savedCopyFrom && (
        <p className="offline-note">
          {t("offlineNote", { time: formatWhen(savedCopyFrom) })}
        </p>
      )}

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
