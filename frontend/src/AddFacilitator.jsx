import { useState } from "react";
import { apiFetch } from "./api.js";
import { useT } from "./i18n.jsx";
import { nameError } from "./farmerRules.js";

function AddFacilitator({ onCancel, onDone }) {
  const t = useT();
  const [name, setName] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function handleSave(event) {
    event.preventDefault();

    const message = nameError(name, "facilitator");
    if (message) {
      setErrors({ name: message });
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const response = await apiFetch("http://localhost:8000/pu/facilitators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name }),
      });
      const data = await response.json();

      if (response.ok) {
        onDone(name.trim());
        return;
      }
      setErrors(typeof data.detail === "object" ? data.detail : {});
    } catch {
      setErrors({ form: "Could not reach the server. Please try again." });
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSave} noValidate>
      <h2>{t("addFf")}</h2>

      <div className="field">
        <label htmlFor="ff-name">{t("ffFullName")}</label>
        <input
          id="ff-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors({});
          }}
          className={errors.name ? "has-error" : ""}
        />
        {errors.name && <p className="error">{errors.name}</p>}
      </div>

      {errors.form && <p className="error">{errors.form}</p>}

      <button type="submit" disabled={saving}>
        {saving ? t("saving") : t("save")}
      </button>
      <button type="button" onClick={onCancel} disabled={saving}>
        {t("cancel")}
      </button>
    </form>
  );
}

export default AddFacilitator;
