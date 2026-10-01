import { useState, useEffect } from "react";
import { useT } from "./i18n.jsx";
import LanguageToggle from "./LanguageToggle.jsx";

// Shows the logo image from public/logos. If the file is missing,
// it shows the name as plain text instead.
function Logo({ file, name }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className="logo-fallback">{name}</span>;
  }
  return (
    <img
      className="logo"
      src={`/logos/${file}`}
      alt={name}
      onError={() => setFailed(true)}
    />
  );
}

function Login({ onLogin }) {
  const t = useT();
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("http://localhost:8000/users")
      .then((response) => response.json())
      .then((data) => setUsers(data))
      .catch(() => setFailed(true));
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    const user = users.find((u) => String(u.id) === userId);
    if (user) {
      onLogin(user);
    }
  }

  return (
    <div className="page login">
      <div className="login-top">
        <LanguageToggle />
      </div>

      <div className="logos">
        <Logo file="bci.png" name="Better Cotton" />
        <Logo file="cofarm.png" name="Cofarm" />
      </div>

      <h1>{t("appName")}</h1>
      <p>{t("signInPrompt")}</p>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="user">{t("chooseUser")}</label>
          <select
            id="user"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">{t("chooseUserOption")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {t(`role_${u.role}`)} · {u.pu_name}
              </option>
            ))}
          </select>
        </div>

        {failed && <p className="error">{t("usersFailed")}</p>}

        <button type="submit" className="primary" disabled={userId === ""}>
          {t("signIn")}
        </button>
      </form>

      <p className="note">{t("demoNote")}</p>
    </div>
  );
}

export default Login;
