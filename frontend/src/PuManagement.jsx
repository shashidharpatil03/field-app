import { useState, useEffect } from "react";
import { apiFetch } from "./api.js";
import { useT } from "./i18n.jsx";
import AddFacilitator from "./AddFacilitator.jsx";
import LeaveFlow from "./LeaveFlow.jsx";
import BulkMove from "./BulkMove.jsx";

function PuManagement({ onHome }) {
  const t = useT();
  const [view, setView] = useState("ffs");
  const [ffs, setFfs] = useState([]);
  const [lgs, setLgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [leaving, setLeaving] = useState(null);
  const [message, setMessage] = useState("");

  function load() {
    return Promise.all([
      apiFetch("http://localhost:8000/pu/facilitators")
        .then((response) => response.json())
        .then((data) => setFfs(data)),
      apiFetch("http://localhost:8000/lgs")
        .then((response) => response.json())
        .then((data) => setLgs(data)),
    ]).then(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function finished(text) {
    // Reload first, then leave the form, so the list is never stale.
    await load();
    setAdding(false);
    setLeaving(null);
    setMessage(text);
  }

  if (loading) {
    return (
      <div className="page">
        <p>Loading...</p>
      </div>
    );
  }

  let body;
  if (view === "move") {
    body = <BulkMove />;
  } else if (adding) {
    body = (
      <AddFacilitator
        onCancel={() => setAdding(false)}
        onDone={(name) => finished(t("ffAdded", { name: name }))}
      />
    );
  } else if (leaving !== null) {
    body = (
      <LeaveFlow
        ff={leaving}
        lgs={lgs.filter((lg) => lg.ff_id === leaving.id)}
        candidates={ffs.filter((f) => f.active === 1 && f.id !== leaving.id)}
        onCancel={() => setLeaving(null)}
        onDone={finished}
      />
    );
  } else {
    body = (
      <div>
        <button onClick={() => setAdding(true)}>{t("addFf")}</button>

        {ffs.map((f) => (
          <div className="card" key={f.id}>
            <h3>
              {f.name}{" "}
              <span
                className={f.active ? "badge continuing" : "badge dropped_out"}
              >
                {f.active ? t("statusActive") : t("statusLeft")}
              </span>
            </h3>
            {f.active ? (
              <div>
                <p>
                  {t("groupsCount", { n: f.lg_count })} ·{" "}
                  {t("farmersCount", { n: f.farmer_count })}
                </p>
                <button
                  onClick={() => {
                    setMessage("");
                    setLeaving(f);
                  }}
                >
                  {t("markLeft")}
                </button>
              </div>
            ) : (
              <p>{t("leftOn", { date: f.left_on })}</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="page">
      <button className="home-button" onClick={onHome}>
        ← {t("back")}
      </button>

      {message && <p className="message">{message}</p>}

      <div className="tabs">
        <button
          className={view === "ffs" ? "tab active" : "tab"}
          onClick={() => {
            setView("ffs");
            setAdding(false);
            setLeaving(null);
            load();
          }}
        >
          {t("tabFfs")}
        </button>
        <button
          className={view === "move" ? "tab active" : "tab"}
          onClick={() => {
            setView("move");
            setMessage("");
          }}
        >
          {t("tabMove")}
        </button>
      </div>

      {body}
    </div>
  );
}

export default PuManagement;
