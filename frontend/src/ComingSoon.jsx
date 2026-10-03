import { useT } from "./i18n.jsx";
import ModuleHeader from "./ModuleHeader.jsx";

function ComingSoon({ onHome, titleKey }) {
  const t = useT();

  return (
    <div className="page">
      <ModuleHeader titleKey={titleKey} onBack={onHome} />
      <p className="message">{t("comingSoon")}</p>
    </div>
  );
}

export default ComingSoon;
