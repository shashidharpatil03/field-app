import { useT } from "./i18n.jsx";

// The green header at the top of a module (Sent, Incomplete, PU Management
// and so on): a back button and the name of the module. The big top bar with
// the logo is only on the home screen.
function ModuleHeader({ titleKey, onBack }) {
  const t = useT();
  return (
    <div className="mhead">
      <button className="mhead-back" onClick={onBack} aria-label={t("back")}>
        ←
      </button>
      <h1>{t(titleKey)}</h1>
    </div>
  );
}

export default ModuleHeader;
