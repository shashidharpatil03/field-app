import { useState } from "react";
import { apiFetch } from "./api.js";
import { useT } from "./i18n.jsx";

// ff: the facilitator who is leaving
// lgs: that facilitator's learning groups
// candidates: the active facilitators who can take the groups over
function LeaveFlow({ ff, lgs, candidates, onCancel, onDone }) {
  const t = useT();
  const [choice, setChoice] = useState({});
  const [allTo, setAllTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function chooseForOne(lgId, ffId) {
    setChoice({ ...choice, [lgId]: ffId });
  }

  function chooseForAll(ffId) {
    setAllTo(ffId);
    if (ffId === "") {
      return;
    }
    const all = {};
    for (const lg of lgs) {
      all[lg.id] = ffId;
    }
    setChoice(all);
  }

  const stillToChoose = lgs.filter((lg) => !choice[lg.id]).length;
  const noOthers = lgs.length > 0 && candidates.length === 0;
  const ready = !noOthers && stillToChoose === 0;

  // How many groups and farmers each new facilitator would get.
  const preview = candidates
    .map((c) => {
      const mine = lgs.filter((lg) => choice[lg.id] === String(c.id));
      return {
        id: c.id,
        name: c.name,
        groups: mine.length,
        farmers: mine.reduce((sum, lg) => sum + lg.farmer_count, 0),
      };
    })
    .filter((p) => p.groups > 0);

  async function handleConfirm() {
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(
        `http://localhost:8000/pu/facilitators/${ff.id}/leave`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignments: lgs.map((lg) => ({
              lg_id: lg.id,
              new_ff_id: Number(choice[lg.id]),
            })),
          }),
        },
      );
      const data = await response.json();

      if (response.ok) {
        onDone(t("leftDone", { name: ff.name, n: data.moved }));
        return;
      }
      setError(
        typeof data.detail === "object"
          ? data.detail.form
          : String(data.detail),
      );
    } catch {
      setError("Could not reach the server. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div>
      <h2>{t("leaveTitle", { name: ff.name })}</h2>

      {lgs.length === 0 && <p>{t("leaveNoGroups")}</p>}
      {noOthers && <p className="message">{t("leaveNoOthers")}</p>}

      {lgs.length > 0 && !noOthers && (
        <div>
          <p>{t("leaveHelp")}</p>

          <div className="field">
            <label htmlFor="give-all">{t("assignAll")}</label>
            <select
              id="give-all"
              value={allTo}
              onChange={(e) => chooseForAll(e.target.value)}
            >
              <option value="">{t("chooseFf")}</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {lgs.map((lg) => (
            <div className="card" key={lg.id}>
              <strong>{lg.lg_code}</strong>
              <p>
                {lg.village} · {t("farmersCount", { n: lg.farmer_count })}
              </p>
              <select
                value={choice[lg.id] ?? ""}
                onChange={(e) => chooseForOne(lg.id, e.target.value)}
                aria-label={lg.lg_code}
              >
                <option value="">{t("chooseFf")}</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {preview.length > 0 && (
            <div className="card">
              {preview.map((p) => (
                <p key={p.id}>
                  <strong>{p.name}</strong>: {t("groupsCount", { n: p.groups })}{" "}
                  · {t("farmersCount", { n: p.farmers })}
                </p>
              ))}
            </div>
          )}

          {stillToChoose > 0 && (
            <p>{t("stillToChoose", { n: stillToChoose })}</p>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <button onClick={handleConfirm} disabled={busy || !ready}>
        {t("confirmLeave")}
      </button>
      <button onClick={onCancel} disabled={busy}>
        {t("cancel")}
      </button>
    </div>
  );
}

export default LeaveFlow;
