import { useState } from "react";
import { LanguageContext } from "./i18n.jsx";
import Login from "./Login.jsx";
import TopBar from "./TopBar.jsx";
import Home from "./Home.jsx";
import FarmerData from "./FarmerData.jsx";
import ComingSoon from "./ComingSoon.jsx";

// Remember the signed-in user and language when the page is refreshed.
function readSaved(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key, value) {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Saving is a convenience only, so ignore problems.
  }
}

function App() {
  const [user, setUser] = useState(() => {
    const saved = readSaved("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [lang, setLangState] = useState(readSaved("lang") === "mr" ? "mr" : "en");
  const [module, setModule] = useState(null);

  function setLang(value) {
    setLangState(value);
    save("lang", value);
  }

  function handleLogin(chosen) {
    setUser(chosen);
    save("user", JSON.stringify(chosen));
  }

  function handleLogOut() {
    setUser(null);
    setModule(null);
    save("user", null);
  }

  let screen;
  if (user === null) {
    screen = <Login onLogin={handleLogin} />;
  } else {
    let content;
    if (module === null) {
      content = <Home onOpen={setModule} />;
    } else if (module === "farmers") {
      content = <FarmerData onHome={() => setModule(null)} />;
    } else {
      content = (
        <ComingSoon labelKey={`menu_${module}`} onHome={() => setModule(null)} />
      );
    }
    screen = (
      <div>
        <TopBar user={user} onLogOut={handleLogOut} />
        {content}
      </div>
    );
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {screen}
    </LanguageContext.Provider>
  );
}

export default App;
