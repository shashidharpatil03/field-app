import { useState } from "react";
import { apiFetch } from "./api.js";
import { useT } from "./i18n.jsx";
import { nameError, ffMobileError } from "./farmerRules.js";
import Required from "./Required.jsx";

function AddFacilitator({ onCancel, onDone }) {
  const t = useT();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function handleSave(event) {
    event.preventDefault();

    // Both answers are checked, so the person sees every problem at once.
    const found = {};
    const nameMessage = nameError(name, "facilitator");
    if (nameMessage) {
      found.name = nameMessage;
    }
    const mobileMessage = ffMobileError(mobile);
    if (mobileMessage) {
      found.mobile = mobileMessage;
    }
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const response = await apiFetch("http://localhost:8000/pu/facilitators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, mobile: mobile }),
      });
      const data = await response.json();

      if (response.ok) {
        onDone(name.trim(), data.ff_code);
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
        <label htmlFor="ff-name">
          {t("ffFullName")}
          <Required />
        </label>
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

      <div className="field">
        <label htmlFor="ff-mobile">
          {t("ffMobile")}
          <Required />
        </label>
        <input
          id="ff-mobile"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={mobile}
          // Only digits are kept, and at most 10 (a pasted "98765 43210"
          // becomes "9876543210").
          onChange={(e) => {
            setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
            setErrors({});
          }}
          className={errors.mobile ? "has-error" : ""}
        />
        {errors.mobile ? (
          <p className="error">{errors.mobile}</p>
        ) : (
          <p className="hint">{t("ffMobileHelp")}</p>
        )}
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
