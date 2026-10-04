import { useState, useEffect } from "react";
import { apiFetch } from "./api.js";
import { useT } from "./i18n.jsx";
import Sheet from "./Sheet.jsx";
import AddLg from "./AddLg.jsx";
import { formatDate } from "./dates.js";

const API = "http://localhost:8000";

// Must match the reasons the server accepts.
const DROP_REASONS = [
  "Group dissolved",
  "Village no longer in the programme",
  "Merged with another group",
  "Other",
];

// The server sends errors either as a text or as { field: text }.
function errorText(detail, fallback) {
  if (typeof detail === "string") {
    return detail;
  }
  if (detail && typeof detail === "object") {
    const first = Object.values(detail)[0];
    if (typeof first === "string") {
      return first;
    }
  }
  return fallback;
}

// The "Learning groups" tab of PU Management (PU manager only).
//   - Every group is a card: code, village and farmers on top; Drop (or
//     Delete, for a group made this season) and the facilitator below.
//   - Tapping the facilitator opens a list to choose another one.
//   - With `leaving` set (a facilitator who is leaving), only that person's
//     groups show, each needs a new facilitator, and a button at the bottom
//     marks the person as left once every group has one.
function LgTab({ lgs, ffs, leaving, onStopLeaving, onChanged, onLeft }) {
  const t = useT();
  const [villages, setVillages] = useState([]);
  const [dropped, setDropped] = useState([]);
  const [showDropped, setShowDropped] = useState(false);
  const [ffFilter, setFfFilter] = useState("");
  const [villageFilter, setVillageFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState(null); // the group whose facilitator is being chosen
  const [picked, setPicked] = useState(null); // the facilitator chosen in the list
  const [action, setAction] = useState(null); // { kind: "drop" | "delete", lg }
  const [reason, setReason] = useState("");
  const [choices, setChoices] = useState({}); // leaving: group id -> new facilitator id
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`${API}/pu/villages`)
      .then((response) => response.json())
      .then((data) => setVillages(data));
    apiFetch(`${API}/pu/lgs/dropped`)
      .then((response) => response.json())
      .then((data) => setDropped(data));
  }, [lgs]);

  const ffById = {};
  for (const f of ffs) {
    ffById[f.id] = f;
  }
  const activeFfs = ffs.filter((f) => f.active === 1);

  // Which groups are on screen.
  const visible = leaving
    ? lgs.filter((lg) => lg.ff_id === leaving.id)
    : lgs.filter(
        (lg) =>
          (ffFilter === "" || String(lg.ff_id) === ffFilter) &&
          (villageFilter === "" || String(lg.village_id) === villageFilter),
      );
  const done = leaving
    ? visible.filter((lg) => choices[lg.id] !== undefined).length
    : 0;
  const waiting = visible.length - done;

  function closeSheets() {
    setPicking(null);
    setPicked(null);
    setAction(null);
    setReason("");
    setConfirmLeave(false);
    setError("");
    setSaving(false);
  }

  // Sends one change to the server. On success the sheets close and the
  // parent reloads the lists and shows `message`.
  async function send(url, body, message) {
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (response.ok) {
        closeSheets();
        return data;
      }
      setError(errorText(data.detail, t("serverError")));
    } catch {
      setError(t("serverError"));
    }
    setSaving(false);
    return null;
  }

  // What the facilitator button on a card says.
  function ffButton(lg) {
    if (leaving) {
      const choice = choices[lg.id];
      return choice === undefined
        ? { text: t("chooseFf"), state: "unset" }
        : { text: ffById[choice]?.name ?? "", state: "done" };
    }
    const ff = ffById[lg.ff_id];
    if (!ff) {
      return { text: t("nobodyYet"), state: "unset" };
    }
    if (ff.active === 0) {
      return { text: t("ffLeftTag", { name: ff.name }), state: "unset" };
    }
    return { text: ff.name, state: "" };
  }

  // "Same facilitator for all": one list, and the choice goes to every group.
  function openPickerForAll() {
    setPicking({ all: true, lg_code: t("allGroupsWord"), ff_id: null });
    setPicked(null);
    setError("");
  }

  function openPicker(lg) {
    setPicking(lg);
    setPicked(leaving ? (choices[lg.id] ?? null) : null);
    setError("");
  }

  async function confirmPick() {
    if (leaving && picking.all) {
      const all = {};
      for (const lg of visible) {
        all[lg.id] = picked;
      }
      setChoices({ ...choices, ...all });
      closeSheets();
      return;
    }
    if (leaving) {
      setChoices({ ...choices, [picking.id]: picked });
      closeSheets();
      return;
    }
    const lg = picking;
    const data = await send(
      `${API}/lgs/${lg.id}/reassign`,
      { new_ff_id: picked },
      "",
    );
    if (data) {
      onChanged(t("movedOk", { code: lg.lg_code, name: ffById[picked].name }));
    }
  }

  async function confirmAction() {
    const lg = action.lg;
    if (action.kind === "drop") {
      if (reason === "") {
        setError(t("lgChooseReason"));
        return;
      }
      const data = await send(`${API}/lgs/${lg.id}/drop`, {
        reason: reason,
        note: "",
      });
      if (data) {
        onChanged(t("lgDropped", { code: lg.lg_code }));
      }
    } else {
      const data = await send(`${API}/lgs/${lg.id}/delete`, {});
      if (data) {
        onChanged(t("lgDeleted", { code: lg.lg_code }));
      }
    }
  }

  async function bringBack(lg) {
    const data = await send(`${API}/lgs/${lg.id}/restore`, {});
    if (data) {
      onChanged(t("lgRestored", { code: lg.lg_code }));
    }
  }

  async function confirmLeaving() {
    const assignments = visible.map((lg) => ({
      lg_id: lg.id,
      new_ff_id: choices[lg.id],
    }));
    const data = await send(
      `${API}/pu/facilitators/${leaving.id}/leave`,
      { assignments: assignments },
      "",
    );
    if (data) {
      onLeft(t("leftDone", { name: leaving.name, n: assignments.length }));
    }
  }

  if (adding) {
    return (
      <AddLg
        villages={villages}
        ffs={activeFfs}
        onCancel={() => setAdding(false)}
        onDone={(code) => {
          setAdding(false);
          onChanged(t("lgAdded", { code: code }));
        }}
      />
    );
  }

  // The list of facilitators to choose from.
  const candidates = activeFfs.filter((f) => !(leaving && f.id === leaving.id));
  const currentFfId = picking ? picking.ff_id : null;

  // For the final confirmation: who gets which groups.
  const summary = {};
  if (confirmLeave) {
    for (const lg of visible) {
      const name = ffById[choices[lg.id]]?.name ?? "";
      summary[name] = [...(summary[name] ?? []), lg.lg_code];
    }
  }

  return (
    <div>
      {leaving ? (
        <div>
          <button className="pu-fchip" onClick={onStopLeaving}>
            {leaving.name} <span aria-hidden="true">✕</span>
          </button>
          <div className="pu-banner">
            <strong>
              {t("leavingProgress", { done: done, n: visible.length })}
            </strong>{" "}
            {t("leavingHelp", { name: leaving.name })}
            <div className="pu-prog">
              <i
                style={{
                  width: `${visible.length === 0 ? 100 : (done * 100) / visible.length}%`,
                }}
              />
            </div>
            {visible.length > 1 && (
              <button className="pu-all" onClick={openPickerForAll}>
                {t("sameForAll")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="pu-filters">
            <select
              value={ffFilter}
              onChange={(e) => setFfFilter(e.target.value)}
              aria-label={t("facilitatorLabel")}
            >
              <option value="">{t("allFacilitators")}</option>
              {activeFfs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <select
              value={villageFilter}
              onChange={(e) => setVillageFilter(e.target.value)}
              aria-label={t("village")}
            >
              <option value="">{t("allVillages")}</option>
              {villages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <button className="primary" onClick={() => setAdding(true)}>
            ＋ {t("lgAdd")}
          </button>
        </div>
      )}

      {visible.map((lg) => {
        const button = ffButton(lg);
        return (
          <div className="pu-lg" key={lg.id}>
            <div className="pu-lg-top">
              <strong>{lg.lg_code}</strong>
              <span>
                {lg.village} · {t("farmersCount", { n: lg.farmer_count })}
              </span>
            </div>
            <div className="pu-lg-bottom">
              <button
                className="pu-drop"
                onClick={() => {
                  setAction({
                    kind: lg.can_delete ? "delete" : "drop",
                    lg: lg,
                  });
                  setError("");
                }}
              >
                ✕ {lg.can_delete ? t("deleteShort") : t("dropShort")}
              </button>
              <button
                className={`pu-ff ${button.state}`}
                onClick={() => openPicker(lg)}
              >
                {button.text} ▾
              </button>
            </div>
          </div>
        );
      })}

      {visible.length === 0 && (
        <p className="hint">{leaving ? t("leavingNoGroups") : t("noGroups")}</p>
      )}

      {!leaving && dropped.length > 0 && (
        <div>
          <button
            className="pu-fold"
            onClick={() => setShowDropped(!showDropped)}
          >
            {t("lgDroppedHeading")} ({dropped.length}) {showDropped ? "▴" : "▾"}
          </button>
          {showDropped &&
            dropped.map((lg) => (
              <div className="pu-lg" key={lg.id}>
                <div className="pu-lg-top">
                  <strong>{lg.lg_code}</strong>
                  <span>{lg.village}</span>
                </div>
                <p className="hint">
                  {t("lgDroppedOn", { date: formatDate(lg.dropped_on) })}
                  {lg.drop_reason ? ` · ${lg.drop_reason}` : ""}
                </p>
                <button disabled={saving} onClick={() => bringBack(lg)}>
                  ↩ {t("lgBringBack")}
                </button>
              </div>
            ))}
          {error && !picking && !action && <p className="error">{error}</p>}
        </div>
      )}

      {leaving && (
        <div className="pu-stick">
          <button
            className="danger solid"
            disabled={waiting > 0}
            onClick={() => setConfirmLeave(true)}
          >
            {waiting > 0
              ? t("leaveWait", { name: leaving.name, n: waiting })
              : t("leaveButton", { name: leaving.name })}
          </button>
        </div>
      )}

      {picking && (
        <Sheet
          title={t("pickTitle", { code: picking.lg_code })}
          onClose={closeSheets}
        >
          {candidates.map((f) => {
            const current = f.id === currentFfId;
            return (
              <button
                key={f.id}
                className={`pu-opt ${picked === f.id ? "on" : ""}`}
                disabled={current}
                onClick={() => setPicked(f.id)}
              >
                <span className="pu-rad" />
                <span>
                  {f.name} <small>({f.ff_code})</small>
                  <small>
                    {current
                      ? t("pickCurrent")
                      : t("pickGroupsNow", { n: f.lg_count })}
                  </small>
                </span>
              </button>
            );
          })}
          {!leaving && picked !== null && (
            <p className="pu-note">
              {t("movePreview", {
                from: ffById[currentFfId]?.name ?? t("nobodyYet"),
                to: ffById[picked].name,
                n: picking.farmer_count,
              })}
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <button
            className="primary"
            disabled={picked === null || saving}
            onClick={confirmPick}
          >
            {leaving
              ? picked === null
                ? t("chooseFf")
                : t("pickChoose", { name: ffById[picked].name })
              : t("moveGroup")}
          </button>
          <button onClick={closeSheets}>{t("cancel")}</button>
        </Sheet>
      )}

      {action && action.kind === "drop" && (
        <Sheet
          title={t("lgDropTitle", { code: action.lg.lg_code })}
          onClose={closeSheets}
        >
          <p className="pu-note warn">
            {t("lgDropWarning", { n: action.lg.farmer_count })}
          </p>
          {DROP_REASONS.map((text) => (
            <button
              key={text}
              className={`pu-opt ${reason === text ? "on" : ""}`}
              onClick={() => setReason(text)}
            >
              <span className="pu-rad" />
              <span>{text}</span>
            </button>
          ))}
          {error && <p className="error">{error}</p>}
          <button
            className="danger solid"
            disabled={saving}
            onClick={confirmAction}
          >
            {t("lgDrop")}
          </button>
          <button onClick={closeSheets}>{t("cancel")}</button>
        </Sheet>
      )}

      {action && action.kind === "delete" && (
        <Sheet
          title={t("lgDeleteTitle", { code: action.lg.lg_code })}
          onClose={closeSheets}
        >
          <p className="pu-note warn">
            {t("lgDeleteWarning", { n: action.lg.farmer_count })}
          </p>
          {error && <p className="error">{error}</p>}
          <button
            className="danger solid"
            disabled={saving}
            onClick={confirmAction}
          >
            {t("lgDeleteConfirm")}
          </button>
          <button onClick={closeSheets}>{t("cancel")}</button>
        </Sheet>
      )}

      {confirmLeave && (
        <Sheet
          title={t("leaveConfirmTitle", { name: leaving.name })}
          onClose={closeSheets}
        >
          <p className="pu-note warn">
            {t("leaveConfirmNote", { name: leaving.name })}
          </p>
          {Object.entries(summary).map(([name, codes]) => (
            <p key={name} className="pu-sum">
              {codes.join(", ")} → <strong>{name}</strong>
            </p>
          ))}
          {error && <p className="error">{error}</p>}
          <button
            className="danger solid"
            disabled={saving}
            onClick={confirmLeaving}
          >
            {saving ? t("saving") : t("leaveConfirmYes")}
          </button>
          <button onClick={closeSheets}>{t("goBack")}</button>
        </Sheet>
      )}
    </div>
  );
}

export default LgTab;
