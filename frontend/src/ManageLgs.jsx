import { useState, useEffect } from "react";
import { apiFetch } from "./api.js";
import { useT } from "./i18n.jsx";

const DROP_REASONS = [
  "Group dissolved",
  "Village no longer in the programme",
  "Merged with another group",
  "Other",
];

const NEW_VILLAGE = "new";

// PU manager only: add a learning group, drop one (all its farmers are
// dropped with it), delete a brand-new one, or bring a dropped one back.
function ManageLgs({ lgs, ffs, onChanged }) {
  const t = useT();
  const [villages, setVillages] = useState([]);
  const [dropped, setDropped] = useState([]);
  const [adding, setAdding] = useState(false);
  const [villageChoice, setVillageChoice] = useState("");
  const [newVillage, setNewVillage] = useState("");
  const [ffId, setFfId] = useState("");
  const [action, setAction] = useState(null); // { kind, lg }
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("http://localhost:8000/pu/villages")
      .then((response) => response.json())
      .then((data) => setVillages(data));
    apiFetch("http://localhost:8000/pu/lgs/dropped")
      .then((response) => response.json())
      .then((data) => setDropped(data));
  }, [lgs]);

  function closeAll() {
    setAdding(false);
    setVillageChoice("");
    setNewVillage("");
    setFfId("");
    setAction(null);
    setReason("");
    setNote("");
    setErrors({});
    setSaving(false);
  }

  async function send(url, body) {
    setSaving(true);
    try {
      const response = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (response.ok) {
        return data;
      }
      setErrors(
        typeof data.detail === "object" ? data.detail : { form: data.detail },
      );
    } catch {
      setErrors({ form: t("serverError") });
    }
    setSaving(false);
    return null;
  }

  async function handleAdd(event) {
    event.preventDefault();
    const body = {
      village_id:
        villageChoice !== "" && villageChoice !== NEW_VILLAGE
          ? Number(villageChoice)
          : null,
      new_village: villageChoice === NEW_VILLAGE ? newVillage : "",
      ff_id: ffId === "" ? null : Number(ffId),
    };
    if (body.village_id === null && body.new_village.trim() === "") {
      setErrors({ village: t("lgChooseVillage") });
      return;
    }
    setErrors({});
    const data = await send("http://localhost:8000/pu/lgs", body);
    if (data) {
      closeAll();
      onChanged(t("lgAdded", { code: data.lg_code }));
    }
  }

  async function handleDrop() {
    if (reason === "") {
      setErrors({ reason: t("lgChooseReason") });
      return;
    }
    setErrors({});
    const lg = action.lg;
    const data = await send(`http://localhost:8000/lgs/${lg.id}/drop`, {
      reason: reason,
      note: note,
    });
    if (data) {
      closeAll();
      onChanged(t("lgDropped", { code: lg.lg_code }));
    }
  }

  async function handleDelete() {
    const lg = action.lg;
    const data = await send(`http://localhost:8000/lgs/${lg.id}/delete`, {});
    if (data) {
      closeAll();
      onChanged(t("lgDeleted", { code: lg.lg_code }));
    }
  }

  async function handleRestore(lg) {
    setAction({ kind: "restore", lg: lg });
    const data = await send(`http://localhost:8000/lgs/${lg.id}/restore`, {});
    if (data) {
      closeAll();
      onChanged(t("lgRestored", { code: lg.lg_code }));
    }
  }

  const activeFfs = ffs.filter((f) => f.active === 1);

  // Confirm panel for dropping or deleting one group.
  if (action && (action.kind === "drop" || action.kind === "delete")) {
    const lg = action.lg;
    if (action.kind === "drop") {
      return (
        <div className="warning-box danger-box">
          <h3>{t("lgDropTitle", { code: lg.lg_code })}</h3>
          <p>{t("lgDropWarning", { n: lg.farmer_count })}</p>
          <fieldset className="radio-group">
            <legend>{t("reason")}</legend>
            {DROP_REASONS.map((text) => (
              <label key={text} className="radio">
                <input
                  type="radio"
                  name="lg-drop-reason"
                  checked={reason === text}
                  onChange={() => setReason(text)}
                />
                {text}
              </label>
            ))}
          </fieldset>
          {errors.reason && <p className="error">{errors.reason}</p>}
          <div className="field">
            <label htmlFor="lg-drop-note">{t("noteOptional")}</label>
            <input
              id="lg-drop-note"
              type="text"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {errors.form && <p className="error">{errors.form}</p>}
          <button
            className="danger solid"
            onClick={handleDrop}
            disabled={saving}
          >
            {t("lgDropConfirm")}
          </button>
          <button onClick={closeAll} disabled={saving}>
            {t("cancel")}
          </button>
        </div>
      );
    }
    return (
      <div className="warning-box danger-box">
        <h3>{t("lgDeleteTitle", { code: lg.lg_code })}</h3>
        <p>{t("lgDeleteWarning", { n: lg.farmer_count })}</p>
        {errors.form && <p className="error">{errors.form}</p>}
        <button
          className="danger solid"
          onClick={handleDelete}
          disabled={saving}
        >
          {t("lgDeleteConfirm")}
        </button>
        <button onClick={closeAll} disabled={saving}>
          {t("cancel")}
        </button>
      </div>
    );
  }

  if (adding) {
    return (
      <form onSubmit={handleAdd} noValidate>
        <h2>{t("lgAdd")}</h2>

        <div className="field">
          <label htmlFor="lg-village">{t("village")}</label>
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
          <label htmlFor="lg-ff">{t("facilitatorLabel")}</label>
          <select
            id="lg-ff"
            value={ffId}
            onChange={(e) => setFfId(e.target.value)}
          >
            <option value="">{t("nobodyYet")}</option>
            {activeFfs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {errors.form && <p className="error">{errors.form}</p>}

        <button type="submit" disabled={saving}>
          {saving ? t("saving") : t("lgAddSave")}
        </button>
        <button type="button" onClick={closeAll} disabled={saving}>
          {t("cancel")}
        </button>
      </form>
    );
  }

  return (
    <div>
      <button onClick={() => setAdding(true)}>{t("lgAdd")}</button>

      {lgs.map((lg) => (
        <div className="card" key={lg.id}>
          <h3>
            {lg.lg_code} · {lg.village}
          </h3>
          <p>
            {t("farmersCount", { n: lg.farmer_count })} ·{" "}
            {lg.ff_name ?? t("nobodyYet")}
          </p>
          {lg.can_delete ? (
            <button
              className="danger"
              onClick={() => setAction({ kind: "delete", lg: lg })}
            >
              {t("lgDelete")}
            </button>
          ) : (
            <button
              className="danger"
              onClick={() => setAction({ kind: "drop", lg: lg })}
            >
              {t("lgDrop")}
            </button>
          )}
        </div>
      ))}

      {dropped.length > 0 && (
        <div>
          <h2>{t("lgDroppedHeading")}</h2>
          {dropped.map((lg) => (
            <div className="card" key={lg.id}>
              <h3>
                {lg.lg_code} · {lg.village}
              </h3>
              <p>
                {t("lgDroppedOn", { date: lg.dropped_on })}
                {lg.drop_reason ? ` · ${lg.drop_reason}` : ""}
              </p>
              {errors.form && action && action.lg.id === lg.id && (
                <p className="error">{errors.form}</p>
              )}
              <button onClick={() => handleRestore(lg)} disabled={saving}>
                {t("lgBringBack")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ManageLgs;
