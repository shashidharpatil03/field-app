import { useT } from "./i18n.jsx";
import LanguageToggle from "./LanguageToggle.jsx";
import Logo from "./Logo.jsx";

// "Ravi Kumar" -> "RK"
function initials(name) {
  return name
    .split(" ")
    .filter((word) => word !== "")
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

// The bar at the top of every screen after sign-in: logo on the left, the
// name of the form in the middle, language on the right. On the home screen
// (no form open) the greeting appears below it.
function TopBar({ user, titleKey }) {
  const t = useT();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "greetMorning" : hour < 17 ? "greetAfternoon" : "greetEvening";

  return (
    <div className="topbar-bg">
      <div className="topbar">
        <div className="header-row">
          <Logo className="header-logo" />
          <div className="header-title">{titleKey ? t(titleKey) : ""}</div>
          <LanguageToggle />
        </div>

        {!titleKey && (
          <div className="welcome-block">
            <div className="avatar" aria-hidden="true">
              {initials(user.name)}
            </div>
            <div>
              <div className="welcome">{t(greeting, { name: user.name })}</div>
              <div className="who">
                {t(`role_${user.role}`)} · {user.pu_name}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TopBar;
