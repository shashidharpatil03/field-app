import { useState, useEffect } from "react";
import FarmerProfile from "./FarmerProfile.jsx";
import RegisterFarmer from "./RegisterFarmer.jsx";
import Facilitators from "./Facilitators.jsx";
import BulkMove from "./BulkMove.jsx";
import BulkParticipation from "./BulkParticipation.jsx";
import FarmerSummary from "./FarmerSummary.jsx";
import { useT } from "./i18n.jsx";
import { apiFetch } from "./api.js";

function FarmerData({ onHome, user }) {
  const t = useT();
  const isManager = user.role === "pu_manager";
  const [lgs, setLgs] = useState([]);
  const [message, setMessage] = useState("");
  const [historyFor, setHistoryFor] = useState(null);
  const [history, setHistory] = useState([]);
  const [farmersFor, setFarmersFor] = useState(null);
  const [farmers, setFarmers] = useState([]);
  const [showDropped, setShowDropped] = useState(false);
  const [view, setView] = useState("lgs");
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedFfId, setSelectedFfId] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [registerLg, setRegisterLg] = useState(null);
  const [registerDraft, setRegisterDraft] = useState(null);
  const [draftsFor, setDraftsFor] = useState(null);
  const [drafts, setDrafts] = useState([]);

  function loadLgs() {
    apiFetch("http://localhost:8000/lgs")
      .then((response) => response.json())
      .then((data) => setLgs(data));
  }

  useEffect(() => {
    loadLgs();
  }, []);

  function toggleHistory(lgId) {
    if (historyFor === lgId) {
      setHistoryFor(null);
      return;
    }
    apiFetch(`http://localhost:8000/lgs/${lgId}/assignments`)
      .then((response) => response.json())
      .then((data) => {
        setHistory(data);
        setHistoryFor(lgId);
      });
  }

  function toggleFarmers(lgId) {
    stopSelecting();
    if (farmersFor === lgId) {
      setFarmersFor(null);
      return;
    }
    apiFetch(
      `http://localhost:8000/lgs/${lgId}/farmers?include_dropped=${showDropped}`,
    )
      .then((response) => response.json())
      .then((data) => {
        setFarmers(data);
        setFarmersFor(lgId);
      });
  }

  function changeShowDropped(lgId, checked) {
    setShowDropped(checked);
    apiFetch(
      `http://localhost:8000/lgs/${lgId}/farmers?include_dropped=${checked}`,
    )
      .then((response) => response.json())
      .then((data) => setFarmers(data));
  }

  function toggleDrafts(lgId) {
    if (draftsFor === lgId) {
      setDraftsFor(null);
      return;
    }
    apiFetch(`http://localhost:8000/lgs/${lgId}/drafts`)
      .then((response) => response.json())
      .then((data) => {
        setDrafts(data);
        setDraftsFor(lgId);
      });
  }

  async function deleteDraft(lgId, draftId) {
    await apiFetch(`http://localhost:8000/drafts/${draftId}`, {
      method: "DELETE",
    });
    const response = await apiFetch(`http://localhost:8000/lgs/${lgId}/drafts`);
    setDrafts(await response.json());
    loadLgs();
  }

  function backFromProfile() {
    setProfileId(null);
    if (farmersFor !== null) {
      apiFetch(
        `http://localhost:8000/lgs/${farmersFor}/farmers?include_dropped=${showDropped}`,
      )
        .then((response) => response.json())
        .then((data) => setFarmers(data));
    }
    loadLgs();
  }

  function startSelecting() {
    setSelecting(true);
    setSelectedIds([]);
  }

  function stopSelecting() {
    setSelecting(false);
    setSelectedIds([]);
  }

  function togglePicked(farmerId) {
    if (selectedIds.includes(farmerId)) {
      setSelectedIds(selectedIds.filter((id) => id !== farmerId));
    } else {
      setSelectedIds([...selectedIds, farmerId]);
    }
  }

  function selectAllContinuing() {
    setSelectedIds(
      farmers.filter((f) => f.participation === "continuing").map((f) => f.id),
    );
  }

  function bulkDone(text) {
    stopSelecting();
    setMessage(text);
    loadLgs();
    apiFetch(
      `http://localhost:8000/lgs/${farmersFor}/farmers?include_dropped=${showDropped}`,
    )
      .then((response) => response.json())
      .then((data) => setFarmers(data));
    window.scrollTo({ top: 0 });
  }

  function closeRegister() {
    setRegisterLg(null);
    setRegisterDraft(null);
  }

  if (profileId !== null) {
    return (
      <div className="page">
        <FarmerProfile farmerId={profileId} onBack={backFromProfile} />
      </div>
    );
  }

  if (registerLg !== null) {
    return (
      <div className="page">
        <RegisterFarmer
          lgId={registerLg.id}
          lgCode={registerLg.lg_code}
          draft={registerDraft}
          onBack={closeRegister}
          onDone={(text) => {
            closeRegister();
            setFarmersFor(null);
            setDraftsFor(null);
            setMessage(text);
            loadLgs();
          }}
        />
      </div>
    );
  }

  const tabs = (
    <div>
      <button className="home-button" onClick={onHome}>
        ← {t("home")}
      </button>

      <FarmerSummary refreshKey={lgs} />

      {isManager && (
        <div className="tabs">
          <button
            className={view === "lgs" ? "tab active" : "tab"}
            onClick={() => setView("lgs")}
          >
            {t("tabLgs")}
          </button>
          <button
            className={view === "ffs" ? "tab active" : "tab"}
            onClick={() => setView("ffs")}
          >
            {t("tabFfs")}
          </button>
          <button
            className={view === "move" ? "tab active" : "tab"}
            onClick={() => setView("move")}
          >
            {t("tabMove")}
          </button>
        </div>
      )}
    </div>
  );

  if (isManager && view === "move") {
    return (
      <div className="page">
        {tabs}
        <BulkMove />
      </div>
    );
  }

  if (isManager && view === "ffs") {
    return (
      <div className="page">
        {tabs}
        <Facilitators
          selectedFfId={selectedFfId}
          onSelect={setSelectedFfId}
          onOpenFarmer={setProfileId}
        />
      </div>
    );
  }

  return (
    <div className="page">
      {tabs}
      <h1>{t("tabLgs")}</h1>
      {message && <p className="message">{message}</p>}

      {lgs.map((lg) => (
        <div className="card" key={lg.id}>
          <h3>{lg.lg_code}</h3>
          <p>
            {lg.village} · {lg.farmer_count} {t("farmers")}
          </p>
          <p>
            {t("facilitator")} {lg.ff_name ?? t("nobodyYet")}
          </p>

          <button onClick={() => toggleHistory(lg.id)}>
            {historyFor === lg.id ? t("hideHistory") : t("history")}
          </button>

          {historyFor === lg.id && (
            <div className="history">
              {history.map((h) => (
                <p key={h.id}>
                  <strong>{h.ff_name}</strong>
                  <br />
                  {h.start_date} {t("to")} {h.end_date ?? t("now")}
                </p>
              ))}
            </div>
          )}

          <button onClick={() => setRegisterLg(lg)}>
            {t("registerFarmer")}
          </button>

          {lg.draft_count > 0 && (
            <button onClick={() => toggleDrafts(lg.id)}>
              {draftsFor === lg.id
                ? t("hideDrafts")
                : t("drafts", { n: lg.draft_count })}
            </button>
          )}

          {draftsFor === lg.id && (
            <ul className="drafts">
              {drafts.map((d) => (
                <li key={d.id}>
                  <strong>{d.name || t("unnamedFarmer")}</strong>
                  <br />
                  <small>
                    {t("saved")} {d.updated_at.replace("T", " ")}
                  </small>
                  <br />
                  <button
                    onClick={() => {
                      setRegisterDraft(d);
                      setRegisterLg(lg);
                    }}
                  >
                    {t("continue")}
                  </button>
                  <button onClick={() => deleteDraft(lg.id, d.id)}>
                    {t("delete")}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button onClick={() => toggleFarmers(lg.id)}>
            {farmersFor === lg.id ? t("hideFarmers") : t("viewFarmers")}
          </button>

          {farmersFor === lg.id && (
            <label className="toggle">
              <input
                type="checkbox"
                checked={showDropped}
                onChange={(e) => changeShowDropped(lg.id, e.target.checked)}
              />
              {t("showDropped")}
            </label>
          )}

          {farmersFor === lg.id && !selecting && (
            <button onClick={startSelecting}>{t("selectSeveral")}</button>
          )}

          {farmersFor === lg.id && selecting && (
            <div>
              <button onClick={selectAllContinuing}>
                {t("selectAllContinuing")}
              </button>
              <button onClick={() => setSelectedIds([])}>{t("clear")}</button>
              <button onClick={stopSelecting}>{t("cancel")}</button>
              <p>{t("nSelected", { n: selectedIds.length })}</p>

              {selectedIds.length > 0 && (
                <BulkParticipation
                  farmers={farmers.filter((f) => selectedIds.includes(f.id))}
                  onDone={bulkDone}
                />
              )}
            </div>
          )}

          {farmersFor === lg.id && (
            <ul className="farmers">
              {farmers.map((f) => (
                <li key={f.id}>
                  {selecting ? (
                    <label className="pick-row">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(f.id)}
                        onChange={() => togglePicked(f.id)}
                      />
                      <span>
                        <strong>{f.farmer_code}</strong> · {f.name}
                        {f.participation === "dropped_out" && (
                          <span className="badge dropped_out">
                            {" "}
                            {t("droppedOut")}
                          </span>
                        )}
                      </span>
                    </label>
                  ) : (
                    <button
                      className="farmer-link"
                      onClick={() => setProfileId(f.id)}
                    >
                      <strong>{f.farmer_code}</strong> · {f.name}
                      {f.participation === "dropped_out" && (
                        <span className="badge dropped_out">
                          {" "}
                          {t("droppedOut")}
                        </span>
                      )}
                      <br />
                      <small>
                        {t(`gender_${f.gender}`)} ·{" "}
                        {f.growing_cotton
                          ? t("growingCotton")
                          : t("notGrowingCotton")}
                      </small>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export default FarmerData;
