import { useState } from "react";
import { useT } from "./i18n.jsx";
import { formatDay } from "./dates.js";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WIDTH = 326;
const HEIGHT = 214;
const LEFT = 26;
const RIGHT = 300;
const TOP = 14;
const BOTTOM = 180;

// A round top for an axis, split into 4 equal steps (so both axes line up
// with the same grid lines): 4, 8, 20, 40, 100 ...
export function niceTop(biggest) {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
  const step = steps.find((s) => s * 4 >= biggest) ?? 1000;
  return step * 4;
}

// "2026-10-03" -> a Date at midday, so time zones cannot move the day.
function dayOf(text) {
  return new Date(`${text}T12:00:00`);
}

// Bars: farmers updated in each week of the season (continued + new +
// dropped out, one number). Line: farmers of last season still to update at
// the end of each week. Drawn by hand as SVG, from the weekly figures that
// come with the dashboard numbers (no extra request, works without signal).
function WeeklyChart({ weekly }) {
  const t = useT();
  const [picked, setPicked] = useState(null);
  if (!weekly || weekly.length === 0) {
    return null;
  }
  const last = weekly.length - 1;
  const index = picked !== null && picked <= last ? picked : last;
  const chosen = weekly[index];

  const leftTop = niceTop(Math.max(...weekly.map((w) => w.updated)));
  const rightTop = niceTop(Math.max(...weekly.map((w) => w.still_to_update)));
  const slot = (RIGHT - LEFT) / weekly.length;
  const barWidth = Math.min(Math.max(slot - 3, 3), 14);
  const yLeft = (v) => BOTTOM - ((BOTTOM - TOP) * v) / leftTop;
  const yRight = (v) => BOTTOM - ((BOTTOM - TOP) * v) / rightTop;
  const centre = (i) => LEFT + slot * i + slot / 2;

  const line = weekly
    .map(
      (w, i) =>
        `${centre(i).toFixed(1)},${yRight(w.still_to_update).toFixed(1)}`,
    )
    .join(" ");

  // A month name under the first week that starts a new month.
  const monthLabels = [];
  weekly.forEach((w, i) => {
    const month = dayOf(w.from).getMonth();
    if (i === 0 || month !== dayOf(weekly[i - 1].from).getMonth()) {
      if (
        monthLabels.length === 0 ||
        i - monthLabels[monthLabels.length - 1].i >= 3
      ) {
        monthLabels.push({ i, text: MONTHS[month] });
      }
    }
  });

  const heading =
    index === last
      ? t("weeklyThisWeek")
      : t("weeklyWeekOf", { day: formatDay(dayOf(chosen.from)) });

  return (
    <div className="card chart-card weekly-card">
      <h3>{t("weeklyTitle")}</h3>
      <p className="weekly-help">{t("weeklyHelp")}</p>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        role="img"
        aria-label={t("weeklyChartLabel")}
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
        {weekly.map((w, i) => {
          const top = yLeft(w.updated);
          return (
            <g key={w.from}>
              {w.updated > 0 && (
                <rect
                  x={centre(i) - barWidth / 2}
                  y={top}
                  width={barWidth}
                  height={BOTTOM - top}
                  rx="2"
                  className={
                    i === index ? "weekly-bar weekly-bar-on" : "weekly-bar"
                  }
                />
              )}
              <rect
                x={LEFT + slot * i}
                y={TOP}
                width={slot}
                height={BOTTOM - TOP}
                fill="transparent"
                onClick={() => setPicked(i)}
              />
            </g>
          );
        })}
        <polyline points={line} className="weekly-line" />
        <circle
          cx={centre(index)}
          cy={yRight(chosen.still_to_update)}
          r="4"
          className="weekly-dot"
        />
        <line
          x1={LEFT}
          x2={RIGHT}
          y1={BOTTOM}
          y2={BOTTOM}
          className="weekly-axis"
        />
        {monthLabels.map((m) => (
          <text
            key={m.i}
            x={centre(m.i)}
            y={BOTTOM + 15}
            textAnchor="middle"
            className="weekly-tick"
          >
            {m.text}
          </text>
        ))}
      </svg>
      <div className="weekly-legend">
        <span>
          <i className="weekly-key-bar" />
          {t("weeklyBars")} (←)
        </span>
        <span>
          <i className="weekly-key-line" />
          {t("weeklyLine")} (→)
        </span>
      </div>
      <div className="weekly-pick" aria-live="polite">
        <strong>{heading}</strong>
        <span>
          {t("weeklySummary", {
            updated: chosen.updated,
            still: chosen.still_to_update,
          })}
        </span>
      </div>
      <p className="weekly-help">{t("weeklyTapHint")}</p>
    </div>
  );
}

export default WeeklyChart;
