// A row of small tappable pills, one per part of a bar: a colour dot, the
// label and the number. Tapping one opens the farmers in that part.
// parts: [{ key, label, value, color }]; onPick(part) gets the tapped part.
function PartChips({ parts, onPick }) {
  return (
    <div className="pchips">
      {parts.map((part) => (
        <button key={part.key} className="pchip" onClick={() => onPick(part)}>
          <span
            className="pdot"
            style={{ background: part.color }}
            aria-hidden="true"
          />
          {part.label} <b>{part.value}</b>
          <span className="pchev" aria-hidden="true">
            ›
          </span>
        </button>
      ))}
    </div>
  );
}

export default PartChips;
