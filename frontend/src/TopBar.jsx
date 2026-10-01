import { useT } from "./i18n.jsx";
import LanguageToggle from "./LanguageToggle.jsx";

function TopBar({ user, onLogOut }) {
  const t = useT();

  return (
    <div className="topbar">
      <div className="topbar-row">
        <div>
          <div className="welcome">{t("welcome", { name: user.name })}</div>
          <div className="who">
            {t(`role_${user.role}`)} · {user.pu_name}
          </div>
        </div>
        <LanguageToggle />
      </div>
      <button className="link-button" onClick={onLogOut}>
        {t("logOut")}
      </button>
    </div>
  );
}

export default TopBar;
