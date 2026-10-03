import { useT } from "./i18n.jsx";
import StackedBar from "./StackedBar.jsx";
import PartChips from "./PartChips.jsx";

export const DONE_COLOR = "#0a7a6c";
export const DROPPED_COLOR = "#c9d8d4";
// Still to update is the red one: those are the farmers who need attention.
export const REMAINING_COLOR = "#a31515";

// Colours for the bar: white text on green and red, dark text on sand.
// callColor is the colour of the small label used for very narrow parts.
export function barParts(continued, dropped, toUpdate) {
  return [
    {
      key: "continued",
      value: continued,
      color: DONE_COLOR,
      textColor: "#fff",
      callColor: DONE_COLOR,
    },
    {
      key: "dropped",
      value: dropped,
      color: DROPPED_COLOR,
      textColor: "#10332e",
      callColor: "#4a6a64",
    },
    {
      key: "to_update",
      value: toUpdate,
      color: REMAINING_COLOR,
      textColor: "#fff",
      callColor: REMAINING_COLOR,
    },
  ];
}

// How far the update of last year's farmers has got: one bar split into
// continued, dropped out and still to update (as percentages), and a tappable
// pill for each with its number.
function ProgressTracker({ lastYear, onOpen }) {
  const t = useT();
  const total = lastYear.total;
  const done = lastYear.continued + lastYear.dropped;
  const parts = barParts(
    lastYear.continued,
    lastYear.dropped,
    lastYear.to_update,
  );
  const labels = {
    continued: t("trackerUpdated"),
    dropped: t("trackerDropped"),
    to_update: t("trackerRemaining"),
  };

  return (
    <div className="lower">
      <h3>{t("trackerTitle", { total: total })}</h3>

      {total === 0 ? (
        <p>{t("trackerEmpty")}</p>
      ) : (
        <div>
          <div className="tracker-head">
            {Math.round((100 * done) / total)}%{" "}
            <small>{t("trackerHeadline", { done: done, total: total })}</small>
          </div>

          <StackedBar
            percent
            parts={parts}
            name={t("trackerDone", { done: done, total: total })}
          />

          <PartChips
            parts={parts.map((part) => ({
              ...part,
              label: labels[part.key],
            }))}
            onPick={(part) => onOpen({ season: part.key })}
          />

          {lastYear.to_update === 0 && (
            <p className="all-done">{t("trackerAllDone")}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default ProgressTracker;
