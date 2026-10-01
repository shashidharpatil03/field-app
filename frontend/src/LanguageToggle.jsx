import { useLanguage } from "./i18n.jsx";

function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      <button
        className={lang === "en" ? "active" : ""}
        onClick={() => setLang("en")}
      >
        English
      </button>
      <button
        className={lang === "mr" ? "active" : ""}
        onClick={() => setLang("mr")}
      >
        मराठी
      </button>
    </div>
  );
}

export default LanguageToggle;
