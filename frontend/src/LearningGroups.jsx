import { useState } from "react";
import FarmerNav from "./FarmerNav.jsx";
import StackedBar from "./StackedBar.jsx";
import { barParts } from "./ProgressTracker.jsx";
import { useT } from "./i18n.jsx";
import { formatWhen } from "./offline.js";

// One compact row per learning group, with a small progress ring for the
// update of last season's farmers and the number of newly added farmers.
// Tapping a row opens the farmer list for that group.
function LearningGroups({ lgs, isManager, savedCopyFrom, nav, onOpen }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const words = query.trim().toLowerCase();
  const shown = lgs.filter(
    (lg) =>
      words === "" ||
      lg.lg_code.toLowerCase().includes(words) ||
      lg.village.toLowerCase().includes(words),
  );

  return (
    <div className="page">
      <FarmerNav active="lgs" {...nav} />

      <h1>{t("tabLgs")}</h1>

      {savedCopyFrom && (
        <p className="offline-note">
          {t("offlineNote", { time: formatWhen(savedCopyFrom) })}
        </p>
      )}

      <div className="field">
        <label htmlFor="lg-search">{t("lgSearchLabel")}</label>
        <input
          id="lg-search"
          type="text"
          value={query}
          placeholder={t("lgSearchPlaceholder")}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {shown.length === 0 && <p>{t("lgNoMatch")}</p>}

      <ul className="group-list">
        {shown.map((lg) => {
          // A copy saved on the phone before this feature existed has no
          // season numbers, so show nothing extra for it.
          const hasSeason =
            typeof lg.season_total === "number" &&
            typeof lg.season_continued === "number";
          return (
            <li key={lg.id}>
              <button className="group-row" onClick={() => onOpen(lg)}>
                <span className="group-text">
                  <span className="group-top">
                    <span className="group-code">{lg.lg_code}</span>
                    <span className="group-village">{lg.village}</span>
                  </span>
                  {isManager && (
                    <small>
                      {t("facilitator")} {lg.ff_name ?? t("nobodyYet")}
                    </small>
                  )}
                  <span className="group-tags">
                    {lg.draft_count > 0 && (
                      <span className="badge neutral">
                        {t("draftsBadge", { n: lg.draft_count })}
                      </span>
                    )}
                    {hasSeason && lg.to_update_count > 0 && (
                      <span className="badge todo">
                        {t("toUpdateChip", { n: lg.to_update_count })}
                      </span>
                    )}
                    {hasSeason &&
                      lg.to_update_count === 0 &&
                      lg.season_total > 0 && (
                        <span className="badge continuing">
                          {t("allUpdatedChip")}
                        </span>
                      )}
                    {hasSeason && lg.new_count > 0 && (
                      <span className="badge continuing">
                        {t("newChip", { n: lg.new_count })}
                      </span>
                    )}
                  </span>
                  {hasSeason && lg.season_total > 0 && (
                    <span className="group-progress">
                      <StackedBar
                        size="thin"
                        parts={barParts(
                          lg.season_continued,
                          lg.season_dropped,
                          lg.to_update_count,
                        )}
                        name={t("lgDone", {
                          done: lg.season_done,
                          total: lg.season_total,
                        })}
                      />
                      <small>
                        {t("lgDone", {
                          done: lg.season_done,
                          total: lg.season_total,
                        })}
                      </small>
                    </span>
                  )}
                </span>
                <span className="chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default LearningGroups;
