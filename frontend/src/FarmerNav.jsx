import { useT } from "./i18n.jsx";
import { HomeIcon } from "./icons.jsx";

// The bar at the top of the Farmer Data screens: a home icon, then two big
// buttons, "Submit Data" and "Dashboard". The one you are on is dark green.
// It stays in view while scrolling.
function FarmerNav({ active, onHome, onSubmit, onDashboard }) {
  const t = useT();

  function tab(name, label, onClick) {
    return (
      <button
        className={active === name ? "active" : ""}
        aria-current={active === name ? "page" : undefined}
        onClick={onClick}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="farmer-nav">
      <button className="nav-home" onClick={onHome} aria-label={t("home")}>
        <HomeIcon />
      </button>
      {tab("submit", t("navSubmit"), onSubmit)}
      {tab("dashboard", t("navDashboard"), onDashboard)}
    </div>
  );
}

export default FarmerNav;
