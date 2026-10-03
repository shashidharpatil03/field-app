import { useState, useEffect } from "react";
import { useT } from "./i18n.jsx";
import { apiFetch } from "./api.js";
import { getPending } from "./offline.js";
import {
  FarmerIcon,
  PracticeIcon,
  CapacityIcon,
  RirIcon,
  PuIcon,
  SentIcon,
  ReadyIcon,
  IncompleteIcon,
} from "./icons.jsx";

const MODULES = [
  { id: "farmers", labelKey: "menu_farmers", Icon: FarmerIcon },
  { id: "practice", labelKey: "menu_practice", Icon: PracticeIcon },
  { id: "capacity", labelKey: "menu_capacity", Icon: CapacityIcon },
  { id: "rir", labelKey: "menu_rir", Icon: RirIcon },
  { id: "pu", labelKey: "menu_pu", Icon: PuIcon, managerOnly: true },
  { id: "sent", labelKey: "menu_sent", Icon: SentIcon },
  { id: "incomplete", labelKey: "menu_incomplete", Icon: IncompleteIcon },
  { id: "sync", labelKey: "menu_sync", Icon: ReadyIcon },
];

function Home({ onOpen, user, onLogOut }) {
  const t = useT();
  const [drafts, setDrafts] = useState(0);
  const [waiting, setWaiting] = useState(getPending().length);

  // Forms saved on this phone, waiting for a signal, shown on the tile.
  useEffect(() => {
    function refresh() {
      setWaiting(getPending().length);
    }
    window.addEventListener("pending-changed", refresh);
    return () => window.removeEventListener("pending-changed", refresh);
  }, []);

  // How many unfinished forms are waiting, shown on the Incomplete tile.
  useEffect(() => {
    apiFetch("http://localhost:8000/drafts")
      .then((response) => (response.ok ? response.json() : []))
      .then((list) => setDrafts(list.length))
      .catch(() => {});
  }, []);

  return (
    <div className="page">
      <div className="menu">
        {MODULES.filter(
          (m) => !m.managerOnly || user.role === "pu_manager",
        ).map((m) => (
          <button
            key={m.id}
            className={`menu-tile tile-${m.id}`}
            onClick={() => onOpen(m.id)}
          >
            <span className="menu-icon">
              <m.Icon />
            </span>
            {m.id === "incomplete" && drafts > 0 && (
              <span className="menu-badge">{drafts}</span>
            )}
            {m.id === "sync" && waiting > 0 && (
              <span className="menu-badge">{waiting}</span>
            )}
            <span className="menu-label">{t(m.labelKey)}</span>
            <span className="menu-sub">{t(`${m.labelKey}_sub`)}</span>
          </button>
        ))}
      </div>

      <button className="link-button logout" onClick={onLogOut}>
        {t("logOut")}
      </button>
    </div>
  );
}

export default Home;
