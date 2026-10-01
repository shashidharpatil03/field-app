import { useState, useEffect } from "react";
import { useT } from "./i18n.jsx";
import { getPending, getLastSync, syncAll, formatWhen } from "./offline.js";

// The bar fixed to the bottom of the home screen. One title, one line of
// status, and a "Sync now" button only when something is waiting.
function SyncStrip({ onOpen }) {
  const t = useT();
  const [pending, setPending] = useState(getPending().length);
  const [lastSync, setLastSync] = useState(getLastSync());
  const [offline, setOffline] = useState(!navigator.onLine);
  const [busy, setBusy] = useState(false);
  // What the last "Sync now" press found: "", "unreachable" or "attention".
  const [problem, setProblem] = useState("");
  const [attention, setAttention] = useState(0);

  useEffect(() => {
    function refresh() {
      setPending(getPending().length);
      setLastSync(getLastSync());
    }
    function goOnline() {
      setOffline(false);
    }
    function goOffline() {
      setOffline(true);
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
    setProblem("");
    try {
      const outcome = await syncAll();
      if (outcome.offline) {
        setProblem("unreachable");
      } else {
        const bad = outcome.results.filter((r) => r.status !== "done").length;
        setAttention(bad);
        if (bad > 0) {
          setProblem("attention");
        }
      }
    } catch {
      setProblem("unreachable");
    }
    setBusy(false);
  }

  let status;
  if (busy) {
    status = t("syncing");
  } else if (problem === "unreachable") {
    status = t("syncUnreachable");
  } else if (problem === "attention") {
    status = t("syncAttention", { n: attention });
  } else if (pending > 0) {
    status = t("syncWaiting", { n: pending });
  } else if (lastSync) {
    status = t("allSynced", { time: formatWhen(lastSync) });
  } else {
    status = t("neverSynced");
  }

  return (
    <div className="sync-strip">
      <div className="sync-inner">
        <button className="sync-open" onClick={onOpen}>
          <span className="sync-title">
            {t("syncTitle")}
            {offline && <span className="sync-pill">{t("offlinePill")}</span>}
          </span>
          <span className="sync-status">{status}</span>
        </button>
        {pending > 0 && (
          <button className="sync-go" onClick={handleSync} disabled={busy}>
            {t("syncNowShort")}
          </button>
        )}
      </div>
    </div>
  );
}

export default SyncStrip;
