import { useT } from "./i18n.jsx";
import { Num } from "./FarmersCard.jsx";
import StackedBar from "./StackedBar.jsx";
import PartChips from "./PartChips.jsx";

// Colours for the profile charts: blues and brown, so they are not mixed up
// with the green, sand and red of the update tracker.
const BLUE = { color: "#45639e", textColor: "#fff", callColor: "#45639e" };
const PALE = { color: "#c2d4f7", textColor: "#0f2b40", callColor: "#0f2b40" };
const BROWN = { color: "#925c4a", textColor: "#fff", callColor: "#925c4a" };
const NAVY = { color: "#0f2b40", textColor: "#fff", callColor: "#0f2b40" };
const GREY = { color: "#d6cfc0", textColor: "#0f2b40", callColor: "#4a5d70" };

// One chart card: a title, a bar with percentages, and a tappable pill for
// each part with its number. Each part knows which filters to open.
function ChartCard({ title, parts, onOpen }) {
  return (
    <div className="card chart-card">
      <h3>{title}</h3>
      <StackedBar percent parts={parts} name={title} />
      <PartChips parts={parts} onPick={(part) => onOpen(part.filters)} />
    </div>
  );
}

// The figures about this season's farmers (continued + new): growing
// cotton, gender and water regime as bars, and the area under cotton as a
// plain number. onOpen(filters) opens the farmer list with those filters.
function FarmerSummary({ data, onOpen }) {
  const t = useT();
  const year = data?.this_year;
  if (!year) {
    return null;
  }
  const season = { season: "this_year" };

  const growing = [
    {
      key: "yes",
      label: t("growYes"),
      value: year.growing_cotton,
      ...BLUE,
      filters: { ...season, growing: "yes" },
    },
    {
      key: "no",
      label: t("growNo"),
      value: year.not_growing,
      ...PALE,
      filters: { ...season, growing: "no" },
    },
  ];
  const gender = [
    {
      key: "Female",
      label: t("genderWomen"),
      value: year.women,
      ...BLUE,
      filters: { ...season, gender: "Female" },
    },
    {
      key: "Male",
      label: t("genderMen"),
      value: year.men,
      ...PALE,
      filters: { ...season, gender: "Male" },
    },
    {
      key: "Other",
      label: t("genderOther"),
      value: year.other_gender,
      ...BROWN,
      filters: { ...season, gender: "Other" },
    },
  ];
  const water = [
    {
      key: "Rainfed",
      label: t("waterRainfed"),
      value: year.water["Rainfed"],
      ...PALE,
      filters: { ...season, water: "Rainfed" },
    },
    {
      key: "Partially irrigated",
      label: t("waterPartial"),
      value: year.water["Partially irrigated"],
      ...BLUE,
      filters: { ...season, water: "Partially irrigated" },
    },
    {
      key: "Fully irrigated",
      label: t("waterFull"),
      value: year.water["Fully irrigated"],
      ...NAVY,
      filters: { ...season, water: "Fully irrigated" },
    },
    {
      key: "none",
      label: t("waterNone"),
      value: year.water.none,
      ...GREY,
      filters: { ...season, water: "none" },
    },
  ];
  // A part with nothing in it gets no pill either.
  const some = (parts) => parts.filter((part) => part.value > 0);

  return (
    <div>
      <h2 className="section-h">{t("thisYearTitle", { total: year.total })}</h2>
      <p className="section-note">{t("thisYearNote")}</p>

      <ChartCard
        title={t("chartGrowing")}
        parts={some(growing)}
        onOpen={onOpen}
      />
      <ChartCard
        title={t("chartGender")}
        parts={some(gender)}
        onOpen={onOpen}
      />
      <ChartCard title={t("chartWater")} parts={some(water)} onOpen={onOpen} />

      <div className="stats">
        <div className="stat">
          <div className="stat-number">
            <Num value={year.total_landholding} decimals={1} />
          </div>
          <div className="stat-label">{t("statLand")}</div>
        </div>
        <div className="stat">
          <div className="stat-number">
            <Num value={year.area_under_cotton} decimals={1} />
          </div>
          <div className="stat-label">{t("statArea")}</div>
        </div>
      </div>
    </div>
  );
}

export default FarmerSummary;
