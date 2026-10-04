import { useState, useEffect } from "react";
import { useT } from "./i18n.jsx";
import { pingServer } from "./api.js";
import {
  getPending,
  getLastSync,
  markSynced,
  syncAll,
  formatWhen,
} from "./offline.js";

// The one sync button, top right of the home screen. The button says where
// things stand in a word ("Synced", "3 to send", "Offline"); under it, in
// small text, is when data last reached the server ("Today 7:49 AM"). Tapping it syncs right now: it
// sends anything waiting, and when it works the time becomes "now". If
// something was refused it opens "Ready to send" instead.
function SyncChip({ onOpen }) {
  const t = useT();
  const [pending, setPending] = useState(getPending().length);
  const [lastSync, setLastSync] = useState(getLastSync());
  const [online, setOnline] = useState(navigator.onLine);
  const [busy, setBusy] = useState(false);
  const [attention, setAttention] = useState(0);

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

  async function handleTap() {
    if (attention > 0) {
      onOpen();
      return;
    }
    setBusy(true);
    try {
      const reachable = await pingServer();
      setOnline(reachable);
      if (reachable) {
        const outcome = await syncAll();
        if (outcome.offline) {
          setOnline(false);
        } else {
          const bad = outcome.results.filter((r) => r.status !== "done").length;
          setAttention(bad);
          if (bad === 0) {
            // Everything that was waiting got through (or nothing was
            // waiting): the phone and the server agree as of now.
            markSynced();
          }
        }
      }
    } catch {
      setOnline(false);
    }
    setPending(getPending().length);
    setLastSync(getLastSync());
    setBusy(false);
  }

  let tone = "ok";
  let word = t("chipSynced");
  if (busy) {
    tone = "busy";
    word = t("syncing");
  } else if (attention > 0) {
    tone = "bad";
    word = t("chipAttention", { n: attention });
  } else if (!online) {
    tone = "off";
    word = t("chipOffline");
  } else if (pending > 0) {
    tone = "wait";
    word = t("chipWaiting", { n: pending });
  }

  return (
    <div className="sync-box">
      <button
        className={`sync-chip ${tone}`}
        onClick={handleTap}
        disabled={busy}
      >
        <span className="sync-chip-icon" aria-hidden="true">
          ↻
        </span>
        <b>{word}</b>
      </button>
      <small className="sync-when">
        {lastSync ? formatWhen(lastSync) : t("neverSyncedShort")}
      </small>
    </div>
  );
}

export default SyncChip;
