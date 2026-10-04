import { useT } from "./i18n.jsx";

// The green header at the top of a module (Sent, Incomplete, PU Management
// and so on): a back button and the name of the module. The big top bar with
// the logo is only on the home screen. Anything passed as children (such as
// a row of tabs) sits inside the green header, under the title.
function ModuleHeader({ titleKey, onBack, children }) {
  const t = useT();
  const row = (
    <>
      <button className="mhead-back" onClick={onBack} aria-label={t("back")}>
        ←
      </button>
      <h1>{t(titleKey)}</h1>
    </>
  );
  if (!children) {
    return <div className="mhead">{row}</div>;
  }
  return (
    <div className="mhead mhead-stack">
      <div className="mhead-row">{row}</div>
      {children}
    </div>
  );
}

export default ModuleHeader;
