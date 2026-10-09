import { useState } from "react";
import { apiFetch } from "./api.js";
import { useT } from "./i18n.jsx";
import { ffMobileError } from "./farmerRules.js";
import Sheet from "./Sheet.jsx";
import Required from "./Required.jsx";

// PU manager only: give a facilitator a new mobile number (for example after
// a change of SIM card). Opens over the facilitator list.
function ChangeFfMobile({ ff, onClose, onDone }) {
  const t = useT();
  const [mobile, setMobile] = useState(ff.mobile ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(event) {
    event.preventDefault();
    const message = ffMobileError(mobile);
    if (message) {
      setError(message);
      return;
    }
    if (mobile === ff.mobile) {
      onClose();
      return;
    }

    setError("");
    setSaving(true);
    try {
      const response = await apiFetch(
        `http://localhost:8000/pu/facilitators/${ff.id}/mobile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mobile: mobile }),
        },
      );
      const data = await response.json();
      if (response.ok) {
        onDone(t("ffMobileChanged", { name: ff.name }));
        return;
      }
      // The server answers {"mobile": "..."} or {"form": "..."}.
      const detail = data.detail;
      setError(
        typeof detail === "object"
          ? detail.mobile || detail.form || t("serverError")
          : detail || t("serverError"),
      );
    } catch {
      setError(t("serverError"));
    }
    setSaving(false);
  }

  return (
    <Sheet title={t("changeNumberTitle", { name: ff.name })} onClose={onClose}>
      <form onSubmit={handleSave} noValidate>
        <div className="field">
          <label htmlFor="ff-new-mobile">
            {t("ffMobile")}
            <Required />
          </label>
          <input
            id="ff-new-mobile"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={mobile}
            onChange={(e) => {
              setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
              setError("");
            }}
            className={error ? "has-error" : ""}
          />
          {error ? (
            <p className="error">{error}</p>
          ) : (
            <p className="hint">{t("ffMobileHelp")}</p>
          )}
        </div>
        <button className="primary" type="submit" disabled={saving}>
          {saving ? t("saving") : t("save")}
        </button>
        <button type="button" onClick={onClose} disabled={saving}>
          {t("cancel")}
        </button>
      </form>
    </Sheet>
  );
}

export default ChangeFfMobile;
