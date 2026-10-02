import { useState } from "react";

// Shows the Co-farm logo from public/logos. If the file is missing, it
// shows the name as plain text instead.
function Logo({ className = "logo" }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className="logo-fallback">Co-farm</span>;
  }
  return (
    <img
      className={className}
      src="/logos/co-farm-logo-png.png"
      alt="Co-farm"
      onError={() => setFailed(true)}
    />
  );
}

export default Logo;
