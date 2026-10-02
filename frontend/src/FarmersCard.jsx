import { useState, useEffect, useRef } from "react";
import { useT } from "./i18n.jsx";
import CountChip from "./CountChip.jsx";
import {
  DONE_COLOR,
  DROPPED_COLOR,
  REMAINING_COLOR,
} from "./ProgressTracker.jsx";

// A number that counts up to its value (a short 0.5 second animation).
// Phones set to "reduce motion" get the number straight away.
export function Num({ value, decimals = 0 }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (typeof value !== "number") {
      return undefined;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) {
      from.current = value;
      setShown(value);
      return undefined;
    }
    const begin = from.current;
    const startedAt = performance.now();
    let frame = 0;
    function step(now) {
      const progress = Math.min((now - startedAt) / 500, 1);
      const eased = 1 - (1 - progress) ** 3;
      setShown(begin + (value - begin) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        from.current = value;
      }
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return typeof value === "number" ? shown.toFixed(decimals) : "–";
}

const NEW_COLOR = "#45639e";

// The first card of the dashboard, laid out like a learning group card:
// this season's farmers as the big number, then four chips. Continued and
// newly added (in the green band) add up to the big number; dropped out and
// still to update are last year's farmers who are not in it.
function FarmersCard({ data, onOpen }) {
  const t = useT();
  const year = data?.this_year;
  const last = data?.last_year;

  return (
    <div className="lgc dash-card">
      <button
        className="lgc-main"
        onClick={() => onOpen({ season: "this_year" })}
      >
        <span className="lgc-text">
          <span className="lgc-code">{t("dashTitle")}</span>
          <span className="lgc-season">
            {t("dashSeason", { season: data ? data.season.label : "" })}
          </span>
        </span>
        <span className="lgc-total">
          <span className="lgc-number">
            <Num value={year?.total} />
          </span>
        </span>
      </button>
      {year && last && (
        <div>
          <div className="lgc-band">
            <CountChip
              color={DONE_COLOR}
              season
              label={t("statusContinued")}
              value={year.continued}
              onPick={() => onOpen({ season: "continued" })}
            />
            <CountChip
              color={NEW_COLOR}
              season
              label={t("statusNew")}
              value={year.new}
              onPick={() => onOpen({ season: "new" })}
            />
          </div>
          <div className="lgc-rest">
            <CountChip
              color={DROPPED_COLOR}
              label={t("droppedOut")}
              value={last.dropped}
              onPick={() => onOpen({ season: "dropped" })}
            />
            <CountChip
              color={REMAINING_COLOR}
              label={t("statusToUpdate")}
              value={last.to_update}
              urgent
              onPick={() => onOpen({ season: "to_update" })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default FarmersCard;
