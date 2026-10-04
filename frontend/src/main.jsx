import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Fonts are saved inside the app (so they work offline). Only the letters
// and weights we use are loaded, to keep the app small.
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-700.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/poppins/devanagari-700.css";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Keep a copy of the app on the phone so it opens with no signal. Browsers
// only allow this on https:// or localhost, and we skip it while developing
// (npm run dev), where files change all the time.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
