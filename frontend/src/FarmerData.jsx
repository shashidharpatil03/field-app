import { useState, useEffect } from "react";
import FarmerProfile from "./FarmerProfile.jsx";
import RegisterFarmer from "./RegisterFarmer.jsx";
import SubmitData from "./SubmitData.jsx";
import Dashboard from "./Dashboard.jsx";
import { apiFetch } from "./api.js";
import { saveLgCache, readLgCache } from "./offline.js";

// What the dashboard can narrow the list by. "" means not narrowed.
const NO_FILTERS = {
  villageId: "",
  lgId: "",
  ffId: "",
  gender: "",
  growing: "",
  water: "",
};

// Which year button and which status button a dashboard figure belongs to.
const SEASON_TO_BUTTON = {
  this_year: { year: "this", status: "all" },
  continued: { year: "this", status: "continued" },
  new: { year: "this", status: "new" },
  dropped: { year: "last", status: "dropped" },
  to_update: { year: "last", status: "to_update" },
};

// Farmer Data has two main screens: Submit Data (the farmers of each
// learning group) and the Dashboard. Tapping a figure on the dashboard opens
// the farmer list with filters. This component decides which one to show,
// and keeps what they need.
function FarmerData({ onHome, user }) {
  const isManager = user.role === "pu_manager";
  const [lgs, setLgs] = useState([]);
  const [savedCopyFrom, setSavedCopyFrom] = useState(null);
  const [screen, setScreen] = useState("submit");
  // What Submit Data shows: which year, which status, which groups are folded.
  const [submitView, setSubmitView] = useState({
    year: "last",
    status: "to_update",
    closed: {},
    filters: NO_FILTERS,
  });
  const [message, setMessage] = useState("");
  const [profileId, setProfileId] = useState(null);
  const [profileEdit, setProfileEdit] = useState(false);
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

  // Opens Submit Data narrowed down, for example { gender: "Female" } when
  // the women figure on the dashboard is tapped. `season` picks the year
  // and status buttons; the rest become chips under the search bar.
  function openFarmers(extra = {}) {
    const { season, ...rest } = extra;
    const button = SEASON_TO_BUTTON[season] || SEASON_TO_BUTTON.this_year;
    setMessage("");
    setSubmitView({
      ...button,
      closed: {},
      filters: { ...NO_FILTERS, ...rest },
    });
    setScreen("submit");
  }

  function showSubmit() {
    setMessage("");
    setScreen("submit");
    loadLgs();
  }

  function showDashboard() {
    setMessage("");
    setScreen("dashboard");
  }

  const nav = {
    onHome: onHome,
    onSubmit: showSubmit,
    onDashboard: showDashboard,
  };

  function openProfile(id, edit = false) {
    setProfileEdit(edit);
    setProfileId(id);
  }

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
          startEditing={profileEdit}
          onBack={() => {
            setProfileId(null);
            loadLgs();
          }}
          onDeleted={(text) => {
            setProfileId(null);
            setMessage(text);
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
            loadLgs();
          }}
        />
      </div>
    );
  }

  if (screen === "dashboard") {
    return (
      <Dashboard
        key="dashboard"
        nav={nav}
        onOpen={openFarmers}
        lgs={lgs}
        isManager={isManager}
      />
    );
  }

  return (
    <SubmitData
      key="submit"
      lgs={lgs}
      isManager={isManager}
      savedCopyFrom={savedCopyFrom}
      view={submitView}
      setView={setSubmitView}
      message={message}
      nav={nav}
      onOpenFarmer={openProfile}
      onRegister={startRegister}
    />
  );
}

export default FarmerData;
