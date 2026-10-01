import { useT } from "./i18n.jsx";
import { FarmerIcon, PracticeIcon, CapacityIcon, RirIcon } from "./icons.jsx";

const MODULES = [
  { id: "farmers", labelKey: "menu_farmers", Icon: FarmerIcon },
  { id: "practice", labelKey: "menu_practice", Icon: PracticeIcon },
  { id: "capacity", labelKey: "menu_capacity", Icon: CapacityIcon },
  { id: "rir", labelKey: "menu_rir", Icon: RirIcon },
];

function Home({ onOpen }) {
  const t = useT();

  return (
    <div className="page">
      <div className="menu">
        {MODULES.map((m) => (
          <button
            key={m.id}
            className={`menu-tile tile-${m.id}`}
            onClick={() => onOpen(m.id)}
          >
            <span className="menu-icon">
              <m.Icon />
            </span>
            <span className="menu-label">{t(m.labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default Home;
