import { useState, useEffect } from "react";
import { setApiUser, setUnauthorizedHandler } from "./api.js";
import { LanguageContext } from "./i18n.jsx";
import Login from "./Login.jsx";
import TopBar from "./TopBar.jsx";
import Home from "./Home.jsx";
import FarmerData from "./FarmerData.jsx";
import ComingSoon from "./ComingSoon.jsx";
import PuManagement from "./PuManagement.jsx";
import SyncScreen from "./SyncScreen.jsx";

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
    const savedUser = saved ? JSON.parse(saved) : null;
    // Must be set before the first screen asks the server for anything.
    setApiUser(savedUser ? savedUser.id : null);
    return savedUser;
  });
  const [lang, setLangState] = useState(
    readSaved("lang") === "mr" ? "mr" : "en",
  );
  const [module, setModule] = useState(null);

  function setLang(value) {
    setLangState(value);
    save("lang", value);
  }

  function handleLogin(chosen) {
    setApiUser(chosen.id);
    setUser(chosen);
    save("user", JSON.stringify(chosen));
  }

  function handleLogOut() {
    setApiUser(null);
    setUser(null);
    setModule(null);
    save("user", null);
  }

  // If the server says "unknown user", go back to the sign-in screen.
  useEffect(() => {
    setUnauthorizedHandler(handleLogOut);
  });

  let screen;
  if (user === null) {
    screen = <Login onLogin={handleLogin} />;
  } else {
    let content;
    if (module === null) {
      content = <Home onOpen={setModule} user={user} />;
    } else if (module === "farmers") {
      content = <FarmerData user={user} onHome={() => setModule(null)} />;
    } else if (module === "pu" && user.role === "pu_manager") {
      content = <PuManagement onHome={() => setModule(null)} />;
    } else if (module === "sync") {
      content = <SyncScreen onHome={() => setModule(null)} />;
    } else {
      content = (
        <ComingSoon
          labelKey={`menu_${module}`}
          onHome={() => setModule(null)}
        />
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
