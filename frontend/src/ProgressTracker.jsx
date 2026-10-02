import { useT } from "./i18n.jsx";
import Donut from "./Donut.jsx";

export const DONE_COLOR = "#14694a";
export const DROPPED_COLOR = "#a31515";
export const REMAINING_COLOR = "#dbbf9e";

// How far the update of last year's farmers has got: farmers confirmed
// or edited (continued), farmers who dropped out, and farmers still to do.
// Each line is a button that opens that list of farmers.
function ProgressTracker({ lastYear, onOpen }) {
  const t = useT();
  const total = lastYear.total;
  const done = lastYear.continued + lastYear.dropped;
  const percent = total > 0 ? Math.round((100 * done) / total) : 0;

  const rows = [
    {
      key: "continued",
      color: DONE_COLOR,
      value: lastYear.continued,
      label: t("trackerUpdated"),
    },
    {
      key: "dropped",
      color: DROPPED_COLOR,
      value: lastYear.dropped,
      label: t("trackerDropped"),
    },
    {
      key: "to_update",
      color: REMAINING_COLOR,
      value: lastYear.to_update,
      label: t("trackerRemaining"),
    },
  ];

  return (
    <div className="card tracker">
      <h3>{t("trackerTitle", { total: total })}</h3>

      {total === 0 ? (
        <p>{t("trackerEmpty")}</p>
      ) : (
        <div>
          <p className="tracker-count">
            {t("trackerDone", { done: done, total: total })}
          </p>
          <div className="tracker-body">
            <Donut
              size={124}
              stroke={18}
              label={`${percent}%`}
              name={t("trackerDone", { done: done, total: total })}
              parts={rows.map((row) => ({
                value: row.value,
                color: row.color,
              }))}
            />
            <div className="legend">
              {rows.map((row) => (
                <button
                  key={row.key}
                  className="legend-row"
                  onClick={() => onOpen({ season: row.key })}
                >
                  <span
                    className="swatch"
                    style={{ background: row.color }}
                    aria-hidden="true"
                  />
                  <span className="legend-number">{row.value}</span>
                  <span className="legend-label">{row.label}</span>
                  <span className="chevron-small" aria-hidden="true">
                    ›
                  </span>
                </button>
              ))}
            </div>
          </div>
          <p className="tracker-help">
            {t("trackerHelp", { done: done, total: total })}
          </p>
        </div>
      )}
    </div>
  );
}

export default ProgressTracker;
