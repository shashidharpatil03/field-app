import { useT } from "./i18n.jsx";
import SyncStrip from "./SyncStrip.jsx";
import {
  FarmerIcon,
  PracticeIcon,
  CapacityIcon,
  RirIcon,
  PuIcon,
} from "./icons.jsx";

const MODULES = [
  { id: "farmers", labelKey: "menu_farmers", Icon: FarmerIcon },
  { id: "practice", labelKey: "menu_practice", Icon: PracticeIcon },
  { id: "capacity", labelKey: "menu_capacity", Icon: CapacityIcon },
  { id: "rir", labelKey: "menu_rir", Icon: RirIcon },
  { id: "pu", labelKey: "menu_pu", Icon: PuIcon, managerOnly: true },
];

function Home({ onOpen, user, onLogOut }) {
  const t = useT();

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
            <span className="menu-label">{t(m.labelKey)}</span>
            <span className="menu-sub">{t(`${m.labelKey}_sub`)}</span>
          </button>
        ))}
      </div>

      <SyncStrip onOpen={() => onOpen("sync")} />

      <button className="link-button logout" onClick={onLogOut}>
        {t("logOut")}
      </button>
    </div>
  );
}

export default Home;
