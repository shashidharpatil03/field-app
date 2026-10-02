import { useState, useEffect, useRef } from "react";
import { useT } from "./i18n.jsx";
import ProgressTracker from "./ProgressTracker.jsx";

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

// The first card of the dashboard. The green top is this season's farmers:
// the big number, and two buttons for the farmers who continued from last
// year and the newly added ones. The white bottom is last year's farmers
// and how far their update has got.
function FarmersCard({ data, onOpen }) {
  const t = useT();
  const year = data?.this_year;

  return (
    <div className="merged">
      <div className="hero">
        <button
          className="hero-top"
          onClick={() => onOpen({ season: "this_year" })}
        >
          <span className="hero-label">
            {t("heroLabel", { season: data ? data.season.label : "" })}
          </span>
          <span className="hero-number">
            <Num value={year?.total} />
          </span>
        </button>
        {year && (
          <div className="pills">
            <button
              className="pill"
              onClick={() => onOpen({ season: "continued" })}
            >
              <b>{year.continued}</b>
              {t("pillContinued")}
            </button>
            <button className="pill" onClick={() => onOpen({ season: "new" })}>
              <b>{year.new}</b>
              {t("pillNew")}
            </button>
          </div>
        )}
      </div>
      {data && <ProgressTracker lastYear={data.last_year} onOpen={onOpen} />}
    </div>
  );
}

export default FarmersCard;
