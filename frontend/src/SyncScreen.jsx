import { useState, useEffect } from "react";
import ModuleHeader from "./ModuleHeader.jsx";
import { useT } from "./i18n.jsx";
import {
  getPending,
  removePending,
  syncAll,
  getLastSync,
  markSynced,
  formatWhen,
} from "./offline.js";

function SyncScreen({ onHome }) {
  const t = useT();
  const [items, setItems] = useState(getPending());
  const [online, setOnline] = useState(navigator.onLine);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const [lastSync, setLastSync] = useState(getLastSync());

  // Keep the list and the online/offline label up to date.
  useEffect(() => {
    function refresh() {
      setItems(getPending());
    }
    function goOnline() {
      setOnline(true);
    }
    function goOffline() {
      setOnline(false);
    }
    window.addEventListener("pending-changed", refresh);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("pending-changed", refresh);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  async function handleSync() {
    setBusy(true);
    setReport(null);
    try {
      const outcome = await syncAll();
      setReport(outcome);
      if (
        !outcome.offline &&
        outcome.results.every((r) => r.status === "done")
      ) {
        markSynced();
      }
      setLastSync(getLastSync());
    } catch {
      setReport({ results: [], offline: false, failed: true });
    }
    setItems(getPending());
    setBusy(false);
  }

  function describe(item) {
    return item.data.name.trim() || t("unnamedFarmer");
  }

  const rejected = report
    ? report.results.filter((r) => r.status !== "done")
    : [];
  const doneCount = report ? report.results.length - rejected.length : 0;

  return (
    <div className="page">
      <ModuleHeader titleKey="menu_sync" onBack={onHome} />

      <p className={online ? "online-note" : "offline-note"}>
        {online ? t("netOnline") : t("netOffline")}
      </p>
      <p>
        {lastSync
          ? t("lastSynced", { time: formatWhen(lastSync) })
          : t("neverSynced")}
      </p>

      <button onClick={handleSync} disabled={busy || items.length === 0}>
        {busy ? t("syncing") : t("syncNow", { n: items.length })}
      </button>

      {report && report.failed && <p className="error">{t("syncFailed")}</p>}
      {report && report.offline && (
        <p className="error">{t("syncStillOffline")}</p>
      )}
      {report && !report.offline && !report.failed && (
        <p className="message">{t("syncDone", { n: doneCount })}</p>
      )}
      {rejected.map((r) => (
        <p className="error" key={r.item.key}>
          {describe(r.item)}: {r.message}
        </p>
      ))}

      {items.length === 0 ? (
        <p>{t("nothingPending")}</p>
      ) : (
        <div>
          <h2>{t("waitingTitle")}</h2>
          {items.map((item) => (
            <div className="card" key={item.key}>
              <h3>{describe(item)}</h3>
              <p>
                {item.lgCode} · {item.submit ? t("kindFarmer") : t("kindDraft")}
              </p>
              <p>
                <small>
                  {t("savedOn")} {formatWhen(item.savedAt)}
                </small>
              </p>
              {item.error && <p className="error">{item.error}</p>}
              <button onClick={() => removePending(item.key)} disabled={busy}>
                {t("discard")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SyncScreen;
