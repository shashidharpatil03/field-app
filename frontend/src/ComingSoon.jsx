import { useT } from "./i18n.jsx";

function ComingSoon({ onHome }) {
  const t = useT();

  return (
    <div className="page">
      <button className="home-button" onClick={onHome}>
        ← {t("back")}
      </button>
      <p className="message">{t("comingSoon")}</p>
    </div>
  );
}

export default ComingSoon;
