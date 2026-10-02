// One chip with a colour dot, a label and a number. Used on the dashboard
// card and on every learning group card, always in the same place. A zero
// is shown greyed out and cannot be tapped.
function CountChip({ color, label, value, urgent, season, onPick }) {
  const classes = ["lgc-chip"];
  // three colour families: green (this season), red (still to update), tan (dropped)
  if (season) {
    classes.push("season");
  } else if (urgent) {
    classes.push("urgent");
  } else {
    classes.push("quiet");
  }
  return (
    <button
      className={classes.join(" ")}
      disabled={value === 0}
      onClick={onPick}
    >
      <span className="lgc-chip-label">
        <span
          className="pdot"
          style={{ background: color }}
          aria-hidden="true"
        />
        <span className="lgc-chip-text">{label}</span>
      </span>
      <b className="lgc-chip-num">{value}</b>
    </button>
  );
}

export default CountChip;
