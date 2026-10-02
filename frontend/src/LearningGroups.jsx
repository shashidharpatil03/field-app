import FarmerNav from "./FarmerNav.jsx";
import Donut from "./Donut.jsx";
import { DONE_COLOR, REMAINING_COLOR } from "./ProgressTracker.jsx";
import { useT } from "./i18n.jsx";
import { formatWhen } from "./offline.js";

// One compact row per learning group, with a small progress ring for the
// update of last season's farmers and the number of newly added farmers.
// Tapping a row opens the farmer list for that group.
function LearningGroups({ lgs, isManager, savedCopyFrom, nav, onOpen }) {
  const t = useT();

  return (
    <div className="page">
      <FarmerNav active="lgs" {...nav} />

      <h1>{t("tabLgs")}</h1>

      {savedCopyFrom && (
        <p className="offline-note">
          {t("offlineNote", { time: formatWhen(savedCopyFrom) })}
        </p>
      )}

      <ul className="group-list">
        {lgs.map((lg) => {
          // A copy saved on the phone before this feature existed has no
          // season numbers, so show nothing extra for it.
          const hasSeason = typeof lg.season_total === "number";
          const percent =
            hasSeason && lg.season_total > 0
              ? Math.round((100 * lg.season_done) / lg.season_total)
              : 0;
          return (
            <li key={lg.id}>
              <button className="group-row" onClick={() => onOpen(lg)}>
                <span className="group-text">
                  <span className="group-code">{lg.lg_code}</span>
                  <small>{lg.village}</small>
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
                </span>
                {hasSeason && lg.season_total > 0 && (
                  <Donut
                    size={56}
                    stroke={8}
                    label={`${percent}%`}
                    name={t("trackerDone", {
                      done: lg.season_done,
                      total: lg.season_total,
                    })}
                    parts={[
                      { value: lg.season_done, color: DONE_COLOR },
                      {
                        value: lg.season_total - lg.season_done,
                        color: REMAINING_COLOR,
                      },
                    ]}
                  />
                )}
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
