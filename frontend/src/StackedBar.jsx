// Whole-number percentages that always add up to exactly 100.
function roundedPercents(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  const exact = values.map((value) => (100 * value) / total);
  const result = exact.map((value) => Math.floor(value));
  let left = 100 - result.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest);
  for (let i = 0; i < left; i += 1) {
    result[order[i].index] += 1;
  }
  return result;
}

// One horizontal bar split into coloured parts that add up to 100%.
// parts: [{ key, value, color, textColor, callColor }]. Parts with 0 are
// left out. Inside each part goes its number, or its percentage when
// `percent` is set. A part too narrow for its text gets a small label above
// the bar instead (only in the "big" size). size "thin" draws a slim bar
// with no text, for list rows.
function StackedBar({ parts, size = "big", percent = false, name }) {
  const shown = parts.filter((part) => part.value > 0);
  const total = shown.reduce((sum, part) => sum + part.value, 0);
  if (total === 0) {
    return null;
  }
  const percents = roundedPercents(shown.map((part) => part.value));

  // Every part is at least 4% wide so that it can always be seen.
  const sizes = shown.map((part) => Math.max(part.value, 0.04 * total));
  const sizeSum = sizes.reduce((sum, value) => sum + value, 0);
  const widths = sizes.map((value) => (100 * value) / sizeSum);

  let start = 0;
  const callouts = [];
  const pieces = shown.map((part, index) => {
    const width = widths[index];
    const centre = Math.min(Math.max(start + width / 2, 6), 94);
    start += width;
    const label = percent
      ? percents[index] < 1
        ? "<1%"
        : `${percents[index]}%`
      : String(part.value);
    let text = "";
    if (size === "big") {
      if (width >= 11) {
        text = label;
      } else {
        callouts.push({ part, centre, label });
      }
    }
    return (
      <div
        key={part.key}
        className="seg"
        style={{
          width: `${width}%`,
          background: part.color,
          color: part.textColor,
        }}
      >
        {text}
      </div>
    );
  });

  return (
    <div role="img" aria-label={name}>
      {callouts.length > 0 && (
        <div className="bar-callrow">
          {callouts.map(({ part, centre, label }) => (
            <span
              key={part.key}
              className="bar-callout"
              style={{ left: `${centre}%`, color: part.callColor }}
            >
              {label}
            </span>
          ))}
        </div>
      )}
      <div className={size === "thin" ? "bar2 thin" : "bar2"}>{pieces}</div>
    </div>
  );
}

export default StackedBar;
