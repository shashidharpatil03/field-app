import { useLanguage } from "./i18n.jsx";

// One small button that shows the OTHER language, so it stays narrow on a
// phone: "मराठी" while the app is in English, "English" while it is in Marathi.
function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <button
      className="lang-button"
      onClick={() => setLang(lang === "en" ? "mr" : "en")}
      aria-label="Change language / भाषा बदला"
    >
      {lang === "en" ? "मराठी" : "English"}
    </button>
  );
}

export default LanguageToggle;
