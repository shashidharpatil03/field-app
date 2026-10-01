import { useT } from "./i18n.jsx";

function ComingSoon({ labelKey, onHome }) {
  const t = useT();

  return (
    <div className="page">
      <button onClick={onHome}>← {t("home")}</button>
      <h1>{t(labelKey)}</h1>
      <p className="message">{t("comingSoon")}</p>
    </div>
  );
}

export default ComingSoon;
