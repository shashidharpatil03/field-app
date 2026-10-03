// A ring split into coloured parts, with a label in the middle.
// parts: [{ value, color }]. The parts are drawn clockwise from the top.
function Donut({ parts, size = 120, stroke = 16, label, caption, name }) {
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const middle = size / 2;

  let used = 0;
  const arcs = parts.map((part, index) => {
    const share = total > 0 ? (part.value / total) * length : 0;
    const arc = (
      <circle
        key={index}
        cx={middle}
        cy={middle}
        r={radius}
        fill="none"
        stroke={part.color}
        strokeWidth={stroke}
        strokeDasharray={`${share} ${length - share}`}
        strokeDashoffset={-used}
        transform={`rotate(-90 ${middle} ${middle})`}
      />
    );
    used += share;
    return arc;
  });

  return (
    <svg
      className="donut"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={name}
    >
      <circle
        cx={middle}
        cy={middle}
        r={radius}
        fill="none"
        stroke="#dbe6e3"
        strokeWidth={stroke}
      />
      {arcs}
      <text
        className="donut-label"
        x={middle}
        y={caption ? middle - 2 : middle}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.24}
      >
        {label}
      </text>
      {caption && (
        <text
          className="donut-caption"
          x={middle}
          y={middle + size * 0.17}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.11}
        >
          {caption}
        </text>
      )}
    </svg>
  );
}

export default Donut;
