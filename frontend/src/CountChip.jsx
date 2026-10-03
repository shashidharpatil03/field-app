// One chip with a colour dot, a label and a number. Used on the dashboard
// card and on every learning group card, always in the same place. A zero
// is shown greyed out and cannot be tapped.
function CountChip({ label, value, urgent, season, blue, onPick }) {
  const classes = ["lgc-chip"];
  // four colour families: blue (continued), green (this season), red (still to update), tan (dropped)
  if (blue) {
    classes.push("blue");
  } else if (season) {
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
        <span className="lgc-chip-text">{label}</span>
      </span>
      <b className="lgc-chip-num">{value}</b>
    </button>
  );
}

export default CountChip;
