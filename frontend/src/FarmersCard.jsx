import { useState, useEffect, useRef } from "react";
import { useT } from "./i18n.jsx";

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

// The first card of the dashboard. The big number is this season's farmers,
// and right under it you can see how it adds up: continued + newly added.
// Below are last year's farmers who are not in it: still to update and
// dropped out. Every figure can be tapped to see those farmers.
function FarmersCard({ data, onOpen }) {
  const t = useT();
  const year = data?.this_year;
  const last = data?.last_year;

  return (
    <div className="dash-hero-wrap">
      <div className="dash-hero">
        <button
          className="dash-hero-top"
          onClick={() => onOpen({ season: "this_year" })}
        >
          <span className="dash-hero-title">
            {t("thisYearTitle", { season: data ? data.season.label : "" })}
          </span>
          <span className="dash-hero-number">
            <Num value={year?.total} />
          </span>
        </button>
        <div className="dash-hero-sum">
          <button
            className="dash-hero-tile"
            disabled={!year || year.continued === 0}
            onClick={() => onOpen({ season: "continued" })}
          >
            <span>{t("statusContinued")}</span>
            <b>{year ? year.continued : "–"}</b>
          </button>
          <span className="dash-hero-plus" aria-hidden="true">
            +
          </span>
          <button
            className="dash-hero-tile"
            disabled={!year || year.new === 0}
            onClick={() => onOpen({ season: "new" })}
          >
            <span>{t("statusNew")}</span>
            <b>{year ? year.new : "–"}</b>
          </button>
        </div>
      </div>

      <div className="dash-pair">
        <button
          className="to-update"
          disabled={!last || last.to_update === 0}
          onClick={() => onOpen({ season: "to_update" })}
        >
          <span>{t("statusToUpdate")}</span>
          <b>{last ? last.to_update : "–"}</b>
        </button>
        <button
          disabled={!last || last.dropped === 0}
          onClick={() => onOpen({ season: "dropped" })}
        >
          <span>{t("droppedOut")}</span>
          <b>{last ? last.dropped : "–"}</b>
        </button>
      </div>
    </div>
  );
}

export default FarmersCard;
