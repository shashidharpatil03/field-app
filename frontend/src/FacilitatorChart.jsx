import { useState } from "react";
import { useT } from "./i18n.jsx";
import { niceTop } from "./WeeklyChart.jsx";

const WIDTH = 326;
const HEIGHT = 244;
const LEFT = 26;
const RIGHT = 300;
const TOP = 14;
const BOTTOM = 176;

// First names for the labels. If two facilitators share a first name, the
// first letter of the last name is added to tell them apart.
function shortNames(people) {
  const first = (name) => name.trim().split(/\s+/)[0];
  return people.map((p) => {
    const same = people.filter((q) => first(q.name) === first(p.name));
    const parts = p.name.trim().split(/\s+/);
    return same.length > 1 && parts.length > 1
      ? `${parts[0]} ${parts[parts.length - 1][0]}.`
      : parts[0];
  });
}

// For the PU manager only: one bar per facilitator (farmers updated, left
// axis) and one yellow dot (farmers still to update, right axis). Dots are
// not joined by a line, because facilitators are not a sequence. The figures
// come with the dashboard numbers, so nothing extra is requested.
function FacilitatorChart({ people }) {
  const t = useT();
  const [picked, setPicked] = useState(null);
  if (!people || people.length === 0) {
    return null;
  }
  const chosen = picked !== null && picked < people.length ? picked : null;
  const names = shortNames(people);
  const tilt = people.length > 5;

  const leftTop = niceTop(Math.max(...people.map((p) => p.updated)));
  const rightTop = niceTop(Math.max(...people.map((p) => p.still_to_update)));
  const slot = (RIGHT - LEFT) / people.length;
  const barWidth = Math.min(Math.max(slot * 0.5, 6), 28);
  const yLeft = (v) => BOTTOM - ((BOTTOM - TOP) * v) / leftTop;
  const yRight = (v) => BOTTOM - ((BOTTOM - TOP) * v) / rightTop;
  const centre = (i) => LEFT + slot * i + slot / 2;

  return (
    <div className="card chart-card weekly-card">
      <h3>{t("ffChartTitle")}</h3>
      <p className="weekly-help">{t("ffChartHelp")}</p>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        role="img"
        aria-label={t("ffChartLabel")}
        className="weekly-svg"
      >
        {[0, 1, 2, 3, 4].map((n) => {
          const y = BOTTOM - ((BOTTOM - TOP) * n) / 4;
          return (
            <g key={n}>
              <line
                x1={LEFT}
                x2={RIGHT}
                y1={y}
                y2={y}
                className="weekly-grid"
              />
              <text
                x={LEFT - 5}
                y={y + 4}
                textAnchor="end"
                className="weekly-tick"
              >
                {(leftTop * n) / 4}
              </text>
              <text
                x={RIGHT + 5}
                y={y + 4}
                className="weekly-tick weekly-tick-right"
              >
                {(rightTop * n) / 4}
              </text>
            </g>
          );
        })}
        {people.map((p, i) => {
          const top = yLeft(p.updated);
          return (
            <g key={p.ff_id}>
              {p.updated > 0 && (
                <rect
                  x={centre(i) - barWidth / 2}
                  y={top}
                  width={barWidth}
                  height={BOTTOM - top}
                  rx="3"
                  className={
                    i === chosen ? "weekly-bar weekly-bar-on" : "weekly-bar"
                  }
                />
              )}
              <circle
                cx={centre(i)}
                cy={yRight(p.still_to_update)}
                r={i === chosen ? 6 : 4.5}
                className="weekly-dot"
              />
              <rect
                x={LEFT + slot * i}
                y={TOP}
                width={slot}
                height={BOTTOM - TOP + 30}
                fill="transparent"
                onClick={() => setPicked(i)}
              />
              <text
                x={centre(i)}
                y={BOTTOM + 14}
                textAnchor={tilt ? "end" : "middle"}
                transform={
                  tilt ? `rotate(-40 ${centre(i)} ${BOTTOM + 14})` : undefined
                }
                className="weekly-tick"
                fontWeight={i === chosen ? 700 : 400}
              >
                {names[i]}
              </text>
            </g>
          );
        })}
        <line
          x1={LEFT}
          x2={RIGHT}
          y1={BOTTOM}
          y2={BOTTOM}
          className="weekly-axis"
        />
      </svg>
      <div className="weekly-legend">
        <span>
          <i className="weekly-key-bar" />
          {t("weeklyBars")} (←)
        </span>
        <span>
          <i className="weekly-key-dot" />
          {t("ffChartDots")} (→)
        </span>
      </div>
      <div className="weekly-pick" aria-live="polite">
        {chosen === null ? (
          <span>{t("ffChartTapHint")}</span>
        ) : (
          <>
            <strong>{people[chosen].name}</strong>
            <span>
              {t("weeklySummary", {
                updated: people[chosen].updated,
                still: people[chosen].still_to_update,
              })}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default FacilitatorChart;
