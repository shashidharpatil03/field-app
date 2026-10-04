import { useState, useEffect } from "react";
import ModuleHeader from "./ModuleHeader.jsx";
import { apiFetch } from "./api.js";
import { useT } from "./i18n.jsx";
import AddFacilitator from "./AddFacilitator.jsx";
import LgTab from "./LgTab.jsx";
import { formatDate } from "./dates.js";

// PU Management (PU manager only). Two tabs in the green header:
//   Facilitators - who is on the team, add one, or mark one as leaving
//   Learning groups - every group, move/drop/add; also where a leaving
//                     facilitator's groups are given to new facilitators.
function PuManagement({ onHome }) {
  const t = useT();
  const [view, setView] = useState("ffs");
  const [ffs, setFfs] = useState([]);
  const [lgs, setLgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingFf, setAddingFf] = useState(false);
  const [leavingFf, setLeavingFf] = useState(null);
  const [showLeft, setShowLeft] = useState(false);
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

  async function changed(text) {
    await load();
    setMessage(text);
  }

  async function leftDone(text) {
    await load();
    setLeavingFf(null);
    setView("ffs");
    setMessage(text);
  }

  function showView(name) {
    setView(name);
    setMessage("");
    setAddingFf(false);
    if (name === "ffs") {
      setLeavingFf(null);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p>Loading...</p>
      </div>
    );
  }

  const active = ffs.filter((f) => f.active === 1);
  const left = ffs.filter((f) => f.active === 0);

  let body;
  if (view === "lgs") {
    body = (
      <LgTab
        lgs={lgs}
        ffs={ffs}
        leaving={leavingFf}
        onStopLeaving={() => setLeavingFf(null)}
        onChanged={changed}
        onLeft={leftDone}
      />
    );
  } else if (addingFf) {
    body = (
      <AddFacilitator
        onCancel={() => setAddingFf(false)}
        onDone={async (name, code) => {
          await load();
          setAddingFf(false);
          setMessage(t("ffAddedCode", { name: name, code: code }));
        }}
      />
    );
  } else {
    body = (
      <div>
        <button className="primary" onClick={() => setAddingFf(true)}>
          ＋ {t("addFf")}
        </button>

        {active.map((f) => (
          <div className="pu-ffrow" key={f.id}>
            <div>
              <strong>{f.name}</strong>
              <small>{f.ff_code}</small>
              <small>
                {t("groupsCount", { n: f.lg_count })} ·{" "}
                {t("farmersCount", { n: f.farmer_count })}
              </small>
            </div>
            <button
              className="pu-leave"
              onClick={() => {
                setMessage("");
                setLeavingFf(f);
                setView("lgs");
              }}
            >
              {t("ffLeavingBtn")}
            </button>
          </div>
        ))}

        {left.length > 0 && (
          <div>
            <button className="pu-fold" onClick={() => setShowLeft(!showLeft)}>
              {t("leftHeading", { n: left.length })} {showLeft ? "▴" : "▾"}
            </button>
            {showLeft &&
              left.map((f) => (
                <div className="pu-ffrow gone" key={f.id}>
                  <div>
                    <strong>{f.name}</strong>
                    <small>{f.ff_code}</small>
                    <small>
                      {t("leftOn", { date: formatDate(f.left_on) })}
                    </small>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <ModuleHeader titleKey="menu_pu" onBack={onHome}>
        <div className="puseg">
          <button
            className={view === "ffs" ? "on" : ""}
            onClick={() => showView("ffs")}
          >
            {t("tabFfs")}
          </button>
          <button
            className={view === "lgs" ? "on" : ""}
            onClick={() => showView("lgs")}
          >
            {t("tabLgGroups")}
          </button>
        </div>
      </ModuleHeader>

      {message && <p className="message">{message}</p>}

      {body}
    </div>
  );
}

export default PuManagement;
