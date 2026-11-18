// Isolated browser component fixture. This file is never an application route.
import { createRoot } from "react-dom/client";
import { EncounterPanel } from "../../apps/web/src/components/encounter-panel";
import { EncounterWorkspace } from "../../apps/web/src/components/encounter-workspace";
import "../../apps/web/src/app/globals.css";
import "../../apps/web/src/app/ui-refinement.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow-condensed/latin-800.css";

const params = new URLSearchParams(location.search), mode = params.get("mode"), accountKey = params.get("actor") ?? "customer";
const props = { signedIn: params.get("guest") !== "true", enabled: true, accountKey };
createRoot(document.getElementById("root")!).render(<>
  <header style={{ background: "#ffd445", padding: "12px 20px", color: "#23473e", fontWeight: 700 }}>Food Go browser fixture. No live restaurant or offer.</header>
  <main style={{ maxWidth: 1100, margin: "auto", paddingBottom: 32 }}>
    {mode === "inventory" || mode === "manage" ? <EncounterWorkspace {...props} mode={mode}/> :
      <EncounterPanel {...props} venueId="a1000000-0000-4000-8000-000000000001" proximity={{ mode: "manual", fix: null }}/>}</main>
</>);
