import { useState, useEffect } from "react";
import FarmerProfile from "./FarmerProfile.jsx";
import RegisterFarmer from "./RegisterFarmer.jsx";
import LearningGroups from "./LearningGroups.jsx";
import FarmerList from "./FarmerList.jsx";
import { apiFetch } from "./api.js";
import { saveLgCache, readLgCache } from "./offline.js";

const NO_FILTERS = {
  villageId: "",
  lgId: "",
  ffId: "",
  q: "",
  status: "continuing",
};

// Farmer Data has two screens: the list of learning groups, and the list of
// farmers (with filters). This component decides which one to show, and
// keeps what both of them need.
function FarmerData({ onHome, user }) {
  const isManager = user.role === "pu_manager";
  const [lgs, setLgs] = useState([]);
  const [savedCopyFrom, setSavedCopyFrom] = useState(null);
  const [screen, setScreen] = useState("groups");
  const [filters, setFilters] = useState(NO_FILTERS);
  const [message, setMessage] = useState("");
  const [scrollSignal, setScrollSignal] = useState(0);
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

  function openGroup(lg) {
    setMessage("");
    setFilters({ ...NO_FILTERS, lgId: String(lg.id) });
    setScreen("farmers");
  }

  function openAll() {
    setMessage("");
    setFilters(NO_FILTERS);
    setScreen("farmers");
  }

  // The "LGs" button: show the group list and scroll down to it.
  function showGroups() {
    setMessage("");
    setScreen("groups");
    setScrollSignal(scrollSignal + 1);
    loadLgs();
  }

  const nav = { onHome: onHome, onLgs: showGroups, onAll: openAll };

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

  return (
    <LearningGroups
      key="groups"
      lgs={lgs}
      isManager={isManager}
      savedCopyFrom={savedCopyFrom}
      nav={nav}
      scrollSignal={scrollSignal}
      onOpen={openGroup}
    />
  );
}

export default FarmerData;
