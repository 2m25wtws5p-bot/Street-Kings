import { useEffect, useState } from "react";
import "@/App.css";
import { HomeScreen } from "@/components/HomeScreen";
import { LocalGame } from "@/components/LocalGame";
import { OnlineFlow } from "@/components/OnlineFlow";
import { RulesDialog } from "@/components/RulesDialog";
import { StatsDialog } from "@/components/StatsDialog";
import { setSoundEnabled } from "@/game/sound";

function App() {
  const [screen, setScreen] = useState("home");
  const [initialCode, setInitialCode] = useState(null);
  const [sound, setSound] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  useEffect(() => {
    setSoundEnabled(sound);
  }, [sound]);

  // deep-link: ?room=CODE opens online join directly
  useEffect(() => {
    try {
      const code = new URL(window.location).searchParams.get("room");
      if (code) {
        setInitialCode(code.toUpperCase());
        setScreen("online");
      }
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="App grain min-h-screen">
      {screen === "home" && (
        <HomeScreen
          onLocal={() => setScreen("local")}
          onOnline={() => { setInitialCode(null); setScreen("online"); }}
          onRules={() => setRulesOpen(true)}
          onStats={() => setStatsOpen(true)}
        />
      )}

      {screen === "local" && <LocalGame onExit={() => setScreen("home")} sound={sound} setSound={setSound} />}

      {screen === "online" && (
        <OnlineFlow initialCode={initialCode} onExit={() => { setInitialCode(null); setScreen("home"); }} sound={sound} setSound={setSound} />
      )}

      <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />
      <StatsDialog open={statsOpen} onOpenChange={setStatsOpen} />
    </div>
  );
}

export default App;
