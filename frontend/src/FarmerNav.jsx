import { useT } from "./i18n.jsx";
import { HomeIcon } from "./icons.jsx";

// Buttons shown at the top of the Farmer Data screens: a home icon, then
// Dashboard, LGs and Farmers. The screen you are on is highlighted. The bar
// stays in view while scrolling.
function FarmerNav({ active, onHome, onDashboard, onLgs, onAll }) {
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
      {tab("dashboard", t("navDashboard"), onDashboard)}
      {tab("lgs", t("navLgs"), onLgs)}
      {tab("farmers", t("navFarmers"), onAll)}
    </div>
  );
}

export default FarmerNav;
