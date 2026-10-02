import { useState } from "react";
import FarmerNav from "./FarmerNav.jsx";
import {
  DONE_COLOR,
  DROPPED_COLOR,
  REMAINING_COLOR,
} from "./ProgressTracker.jsx";
import CountChip from "./CountChip.jsx";
import { useT } from "./i18n.jsx";
import { formatWhen } from "./offline.js";

const NEW_COLOR = "#45639e";

// One card per learning group. Tapping the top part opens all its farmers;
// tapping a chip opens only the farmers in that group with that status.
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
          // A copy saved on the phone before these numbers existed has
          // none of them, so show only the code and village for it.
          const hasSeason =
            typeof lg.season_farmers === "number" &&
            typeof lg.season_continued === "number" &&
            typeof lg.season_dropped === "number" &&
            typeof lg.new_count === "number" &&
            typeof lg.to_update_count === "number";
          return (
            <li key={lg.id}>
              <div className="lgc">
                <button className="lgc-main" onClick={() => onOpen(lg)}>
                  <span className="lgc-text">
                    <span className="lgc-code">{lg.lg_code}</span>
                    <span className="lgc-sub">
                      {lg.village}
                      {isManager && (
                        <span>
                          <span className="lgc-sep"> | </span>
                          {lg.ff_name ?? t("nobodyYet")}
                        </span>
                      )}
                    </span>
                  </span>
                  {hasSeason && (
                    <span className="lgc-total">
                      <span className="lgc-number">{lg.season_farmers}</span>
                      <span className="lgc-caption">{t("lgFarmersLabel")}</span>
                    </span>
                  )}
                </button>

                {hasSeason && (
                  <div>
                    <div className="lgc-band">
                      <CountChip
                        color={DONE_COLOR}
                        season
                        label={t("statusContinued")}
                        value={lg.season_continued}
                        onPick={() => onOpen(lg, { season: "continued" })}
                      />
                      <CountChip
                        color={NEW_COLOR}
                        season
                        label={t("statusNew")}
                        value={lg.new_count}
                        onPick={() => onOpen(lg, { season: "new" })}
                      />
                    </div>
                    <div className="lgc-rest">
                      <CountChip
                        color={DROPPED_COLOR}
                        label={t("droppedOut")}
                        value={lg.season_dropped}
                        onPick={() => onOpen(lg, { season: "dropped" })}
                      />
                      <CountChip
                        color={REMAINING_COLOR}
                        label={t("statusToUpdate")}
                        value={lg.to_update_count}
                        urgent
                        onPick={() => onOpen(lg, { season: "to_update" })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default LearningGroups;
