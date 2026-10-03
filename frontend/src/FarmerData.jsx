import { useState, useEffect } from "react";
import FarmerProfile from "./FarmerProfile.jsx";
import RegisterFarmer from "./RegisterFarmer.jsx";
import LearningGroups from "./LearningGroups.jsx";
import Dashboard from "./Dashboard.jsx";
import FarmerList from "./FarmerList.jsx";
import { apiFetch } from "./api.js";
import { saveLgCache, readLgCache } from "./offline.js";

const NO_FILTERS = {
  villageId: "",
  lgId: "",
  ffId: "",
  q: "",
  status: "all",
  gender: "",
  growing: "",
  water: "",
  season: "",
};

// Farmer Data has three screens: the dashboard, the list of learning groups,
// and the list of farmers (with filters). This component decides which one
// to show, and keeps what they need.
function FarmerData({ onHome, user }) {
  const isManager = user.role === "pu_manager";
  const [lgs, setLgs] = useState([]);
  const [savedCopyFrom, setSavedCopyFrom] = useState(null);
  const [screen, setScreen] = useState("dashboard");
  const [filters, setFilters] = useState(NO_FILTERS);
  const [message, setMessage] = useState("");
  const [profileId, setProfileId] = useState(null);
  const [registerLg, setRegisterLg] = useState(null);
  const [registerDraft, setRegisterDraft] = useState(null);

  // Keeps a copy of the list on the phone, so that with no signal the
  // facilitator still sees their groups and can register farmers.
  function loadLgs() {
    apiFetch("http://localhost:8000/lgs")
      .then((response) => {
        if (!response.ok) {
          throw new Error("not ok");
        }
        return response.json();
      })
      .then((data) => {
        setLgs(data);
        saveLgCache(data);
        setSavedCopyFrom(null);
      })
      .catch(() => {
        const cached = readLgCache();
        if (cached) {
          setLgs(cached.lgs);
          setSavedCopyFrom(cached.savedAt);
        }
      });
  }

  useEffect(() => {
    loadLgs();
  }, []);

  // Opens one group's farmers. `extra` can narrow it further, for example
  // { season: "to_update" } when the "Still to update" chip is tapped.
  function openGroup(lg, extra = {}) {
    setMessage("");
    setFilters({ ...NO_FILTERS, lgId: String(lg.id), ...extra });
    setScreen("farmers");
  }

  // Opens the farmer list with some filters already set, for example
  // { gender: "Female" } when the women card is tapped.
  function openFarmers(extra = {}) {
    setMessage("");
    setFilters({ ...NO_FILTERS, ...extra });
    setScreen("farmers");
  }

  function showGroups() {
    setMessage("");
    setScreen("groups");
    loadLgs();
  }

  function showDashboard() {
    setMessage("");
    setScreen("dashboard");
  }

  const nav = {
    onHome: onHome,
    onDashboard: showDashboard,
    onLgs: showGroups,
    onAll: () => openFarmers(),
  };

  function startRegister(lg, draft) {
    setMessage("");
    setRegisterDraft(draft);
    setRegisterLg(lg);
  }

  function closeRegister() {
    setRegisterLg(null);
    setRegisterDraft(null);
  }

  if (profileId !== null) {
    return (
      <div key="profile" className="page">
        <FarmerProfile
          farmerId={profileId}
          onBack={() => {
            setProfileId(null);
            loadLgs();
          }}
          onDeleted={(text) => {
            setProfileId(null);
            setMessage(text);
            setScreen("farmers");
            loadLgs();
          }}
        />
      </div>
    );
  }

  if (registerLg !== null) {
    return (
      <div key="register" className="page">
        <RegisterFarmer
          lgId={registerLg.id}
          lgCode={registerLg.lg_code}
          draft={registerDraft}
          onBack={closeRegister}
          onDone={(text) => {
            closeRegister();
            setMessage(text);
            setScreen("farmers");
            loadLgs();
          }}
        />
      </div>
    );
  }

  if (screen === "farmers") {
    return (
      <FarmerList
        key="farmers"
        lgs={lgs}
        filters={filters}
        setFilters={setFilters}
        isManager={isManager}
        message={message}
        nav={nav}
        onOpenFarmer={setProfileId}
        onRegister={startRegister}
        onChanged={loadLgs}
      />
    );
  }

  if (screen === "groups") {
    return (
      <LearningGroups
        key="groups"
        lgs={lgs}
        isManager={isManager}
        savedCopyFrom={savedCopyFrom}
        nav={nav}
        onOpen={openGroup}
      />
    );
  }

  return <Dashboard key="dashboard" nav={nav} onOpen={openFarmers} />;
}

export default FarmerData;
