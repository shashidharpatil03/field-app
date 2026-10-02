import { useT } from "./i18n.jsx";

// Three buttons shown at the top of the Farmer Data screens. The one for the
// screen you are on is highlighted. The bar stays in view while scrolling.
function FarmerNav({ active, onHome, onLgs, onAll }) {
  const t = useT();

  return (
    <div className="farmer-nav">
      <button onClick={onHome}>{t("home")}</button>
      <button
        className={active === "lgs" ? "active" : ""}
        aria-current={active === "lgs" ? "page" : undefined}
        onClick={onLgs}
      >
        {t("navLgs")}
      </button>
      <button
        className={active === "farmers" ? "active" : ""}
        aria-current={active === "farmers" ? "page" : undefined}
        onClick={onAll}
      >
        {t("viewAllFarmers")}
      </button>
    </div>
  );
}

export default FarmerNav;
