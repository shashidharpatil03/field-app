import { useState } from "react";
import { apiFetch } from "./api.js";
import { useT } from "./i18n.jsx";
import Required from "./Required.jsx";

const NEW_VILLAGE = "new";

// PU manager only: create a learning group. The village and the
// facilitator are both required; the group number is given automatically.
function AddLg({ villages, ffs, onCancel, onDone }) {
  const t = useT();
  const [villageChoice, setVillageChoice] = useState("");
  const [newVillage, setNewVillage] = useState("");
  const [ffId, setFfId] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function handleSave(event) {
    event.preventDefault();
    const found = {};
    if (
      villageChoice === "" ||
      (villageChoice === NEW_VILLAGE && newVillage.trim() === "")
    ) {
      found.village = t("lgChooseVillage");
    }
    if (ffId === "") {
      found.ff = t("ffRequired");
    }
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch("http://localhost:8000/pu/lgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          village_id:
            villageChoice !== NEW_VILLAGE ? Number(villageChoice) : null,
          new_village: villageChoice === NEW_VILLAGE ? newVillage : "",
          ff_id: Number(ffId),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        onDone(data.lg_code);
        return;
      }
      setErrors(
        typeof data.detail === "object" ? data.detail : { form: data.detail },
      );
    } catch {
      setErrors({ form: t("serverError") });
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSave} noValidate className="card">
      <h2>{t("lgAdd")}</h2>

      <div className="field">
        <label htmlFor="lg-village">
          {t("village")}
          <Required />
        </label>
        <select
          id="lg-village"
          value={villageChoice}
          onChange={(e) => {
            setVillageChoice(e.target.value);
            setErrors({});
          }}
          className={errors.village ? "has-error" : ""}
        >
          <option value="">{t("lgPickVillage")}</option>
          {villages.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
          <option value={NEW_VILLAGE}>{t("lgNewVillage")}</option>
        </select>
      </div>

      {villageChoice === NEW_VILLAGE && (
        <div className="field">
          <label htmlFor="lg-new-village">{t("lgNewVillageName")}</label>
          <input
            id="lg-new-village"
            type="text"
            value={newVillage}
            onChange={(e) => {
              setNewVillage(e.target.value);
              setErrors({});
            }}
            className={errors.village ? "has-error" : ""}
          />
        </div>
      )}
      {errors.village && <p className="error">{errors.village}</p>}

      <div className="field">
        <label htmlFor="lg-ff">
          {t("facilitatorLabel")}
          <Required />
        </label>
        <select
          id="lg-ff"
          value={ffId}
          onChange={(e) => {
            setFfId(e.target.value);
            setErrors({});
          }}
          className={errors.ff ? "has-error" : ""}
        >
          <option value="">{t("chooseFf")}</option>
          {ffs.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.ff_code})
            </option>
          ))}
        </select>
        {errors.ff && <p className="error">{errors.ff}</p>}
      </div>

      <p className="hint">{t("lgNumberAuto")}</p>
      {errors.form && <p className="error">{errors.form}</p>}

      <button type="submit" className="primary" disabled={saving}>
        {saving ? t("saving") : t("save")}
      </button>
      <button type="button" onClick={onCancel} disabled={saving}>
        {t("cancel")}
      </button>
    </form>
  );
}

export default AddLg;
