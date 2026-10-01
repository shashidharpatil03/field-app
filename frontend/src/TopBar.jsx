import { useT } from "./i18n.jsx";
import LanguageToggle from "./LanguageToggle.jsx";

// "Ravi Kumar" -> "RK"
function initials(name) {
  return name
    .split(" ")
    .filter((word) => word !== "")
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function TopBar({ user, onLogOut }) {
  const t = useT();

  return (
    <div className="topbar">
      <div className="topbar-row">
        <div className="avatar" aria-hidden="true">
          {initials(user.name)}
        </div>
        <div className="topbar-text">
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
