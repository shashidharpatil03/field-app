import { useState, useEffect } from "react";
import { useT } from "./i18n.jsx";
import { pingServer } from "./api.js";
import { getPending, getLastSync, syncAll, formatWhen } from "./offline.js";

// The sync card on the home screen: whether the phone can reach the server
// (Online / Offline), what is waiting to be sent, and when data last reached
// the server. "Sync now" is always there: it sends anything waiting, and
// with nothing waiting it checks the connection and says so.
function SyncStrip({ onOpen }) {
  const t = useT();
  const [pending, setPending] = useState(getPending().length);
  const [lastSync, setLastSync] = useState(getLastSync());
  const [online, setOnline] = useState(navigator.onLine);
  const [busy, setBusy] = useState(false);
  // What the last "Sync now" press found: "", "unreachable" or "attention".
  const [problem, setProblem] = useState("");
  const [attention, setAttention] = useState(0);
  // "Up to date" is shown for a few seconds after a press that found
  // nothing to send.
  const [upToDate, setUpToDate] = useState(false);

  useEffect(() => {
    // The phone's own online flag is not trustworthy on a poor connection,
    // so ask the server every half minute while this screen is open.
    function check() {
      if (document.visibilityState === "visible") {
        pingServer().then(setOnline);
      }
    }
    function refresh() {
      setPending(getPending().length);
      setLastSync(getLastSync());
    }
    function goOffline() {
      setOnline(false);
    }
    check();
    const timer = setInterval(check, 30000);
    window.addEventListener("pending-changed", refresh);
    window.addEventListener("online", check);
    window.addEventListener("offline", goOffline);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pending-changed", refresh);
      window.removeEventListener("online", check);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!upToDate) {
      return undefined;
    }
    const timer = setTimeout(() => setUpToDate(false), 4000);
    return () => clearTimeout(timer);
  }, [upToDate]);

  async function handleSync() {
    setBusy(true);
    setProblem("");
    setUpToDate(false);
    try {
      const reachable = await pingServer();
      setOnline(reachable);
      if (!reachable) {
        setProblem("unreachable");
      } else {
        const outcome = await syncAll();
        if (outcome.offline) {
          setProblem("unreachable");
        } else {
          const bad = outcome.results.filter((r) => r.status !== "done").length;
          setAttention(bad);
          if (bad > 0) {
            setProblem("attention");
          } else {
            setUpToDate(true);
          }
        }
      }
    } catch {
      setProblem("unreachable");
    }
    setBusy(false);
  }

  let status = "";
  if (busy) {
    status = t("syncing");
  } else if (problem === "unreachable") {
    status = t("syncUnreachable");
  } else if (problem === "attention") {
    status = t("syncAttention", { n: attention });
  } else if (pending > 0) {
    status = t("syncWaiting", { n: pending });
  } else if (upToDate) {
    status = t("upToDate");
  }

  return (
    <div className="sync-strip">
      <div className="sync-inner">
        <button className="sync-open" onClick={onOpen}>
          <span className="sync-title">
            {t("syncTitle")}
            <span className={online ? "sync-pill on" : "sync-pill off"}>
              <span className="sync-dot" aria-hidden="true" />
              {online ? t("onlinePill") : t("offlinePill")}
            </span>
          </span>
          {status && <span className="sync-status">{status}</span>}
          <span className="sync-last">
            {lastSync
              ? t(online ? "syncedAt" : "lastSyncedAt", {
                  time: formatWhen(lastSync),
                })
              : t("neverSynced")}
          </span>
        </button>
        <button className="sync-go" onClick={handleSync} disabled={busy}>
          {t("syncNowShort")}
        </button>
      </div>
    </div>
  );
}

export default SyncStrip;
