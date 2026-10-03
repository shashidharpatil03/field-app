import { useT } from "./i18n.jsx";
import { HomeIcon } from "./icons.jsx";

// The green header at the top of the Farmer Data screens. A home button,
// then two underlined tabs: "Submit Data" and "Dashboard". Whatever the
// screen puts between the tags (the year switch and the status buttons on
// Submit Data) sits inside the same green block.
function FarmerNav({ active, onHome, onSubmit, onDashboard, children }) {
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
    <div className={`fhead${children ? "" : " fhead-short"}`}>
      <div className="ftabs">
        {tab("submit", t("navSubmit"), onSubmit)}
        {tab("dashboard", t("navDashboard"), onDashboard)}
        <button className="fhome" onClick={onHome} aria-label={t("home")}>
          <HomeIcon />
        </button>
      </div>
      {children}
    </div>
  );
}

export default FarmerNav;
