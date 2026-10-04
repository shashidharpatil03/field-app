import { useState, useEffect } from "react";
import ModuleHeader from "./ModuleHeader.jsx";
import { useT } from "./i18n.jsx";
import { apiFetch } from "./api.js";
import { isNetworkError, queueDraftDelete, removePending } from "./offline.js";

// Forms saved as drafts, from every learning group this person can see.
// Continue reopens the form; Delete form throws the draft away.
function Incomplete({ onHome, onContinue }) {
  const t = useT();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);
  const [sure, setSure] = useState(null);

  async function load() {
    try {
      const response = await apiFetch("http://localhost:8000/drafts");
      if (!response.ok) {
        throw new Error("not ok");
      }
      setItems(await response.json());
      setError(false);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(draft) {
    try {
      // A form kept on the phone: throw away the waiting copy. If it is also
      // a draft on the server, that one is deleted too.
      if (draft.pending) {
        removePending(draft.pendingKey);
      }
      if (draft.id > 0) {
        try {
          await apiFetch(`http://localhost:8000/drafts/${draft.id}`, {
            method: "DELETE",
          });
        } catch (error) {
          if (!isNetworkError(error) || !queueDraftDelete(draft)) {
            throw error;
          }
        }
      }
      setSure(null);
      await load();
    } catch {
      setError(true);
    }
  }

  return (
    <div className="page">
      <ModuleHeader titleKey="menu_incomplete" onBack={onHome} />
      <p className="section-note">{t("incompleteNote")}</p>

      {error && <p className="offline-note">{t("listOffline")}</p>}
      {!error && items === null && <p className="count-line">{t("loading")}</p>}
      {items !== null && items.length === 0 && (
        <p className="message">{t("incompleteEmpty")}</p>
      )}

      <ul className="farmer-list">
        {(items || []).map((d) => (
          <li className="farmer-row" key={d.id}>
            <div className="st-draft">
              <div className="frow-top static">
                <span className="frow-code">{d.lg_code}</span>
                <strong>{d.name || t("unnamedFarmer")}</strong>
              </div>
              <div className="frow-bottom wrap">
                <span className="frow-village">
                  {d.village} · {t("saved")} {d.updated_at.replace("T", " ")}
                </span>
                <span className="draft-actions">
                  <button className="primary" onClick={() => onContinue(d)}>
                    {t("continue")}
                  </button>
                  {sure === d.id ? (
                    <button className="danger" onClick={() => remove(d)}>
                      {t("deleteFormSure")}
                    </button>
                  ) : (
                    <button onClick={() => setSure(d.id)}>
                      {t("deleteForm")}
                    </button>
                  )}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Incomplete;
