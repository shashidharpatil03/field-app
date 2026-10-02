import { WATER_REGIMES } from "./farmerRules.js";

// The three land questions, shared by the register and edit forms.
function LandFields({
  idPrefix,
  total,
  setTotal,
  cotton,
  setCotton,
  growingCotton,
  water,
  setWater,
  errors,
}) {
  const locked = growingCotton === "no";

  return (
    <div>
      <div className="field">
        <label htmlFor={`${idPrefix}-total`}>Total landholding (acres)</label>
        <input
          id={`${idPrefix}-total`}
          type="text"
          inputMode="decimal"
          maxLength={6}
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          className={errors.total_landholding ? "has-error" : ""}
        />
        {errors.total_landholding && (
          <p className="error">{errors.total_landholding}</p>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-cotton-area`}>
          Area under cotton (acres)
        </label>
        <input
          id={`${idPrefix}-cotton-area`}
          type="text"
          inputMode="decimal"
          maxLength={6}
          value={cotton}
          disabled={locked}
          onChange={(e) => setCotton(e.target.value)}
          className={errors.area_under_cotton ? "has-error" : ""}
        />
        {locked && (
          <p className="hint">Not growing cotton, so this is always 0.</p>
        )}
        {errors.area_under_cotton && (
          <p className="error">{errors.area_under_cotton}</p>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-water`}>Water regime</label>
        <select
          id={`${idPrefix}-water`}
          value={water}
          onChange={(e) => setWater(e.target.value)}
          className={errors.water_regime ? "has-error" : ""}
        >
          <option value="">Choose...</option>
          {WATER_REGIMES.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        {errors.water_regime && <p className="error">{errors.water_regime}</p>}
      </div>
    </div>
  );
}

export default LandFields;
