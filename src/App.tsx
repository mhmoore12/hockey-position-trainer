import { useEffect, useState } from "react";
import dragonLogo from "./assets/Dragon.png";
import "./App.css";
import PositionTrainerPage from "./pages/PositionTrainer";
import WristShot from "./pages/WristShot";
import CurvesPage from "./pages/Curves";

type PageKey = "trainer" | "wrist" | "sticks";

const nav = [
  {
    key: "trainer",
    label: "Position trainer",
    hint: "Half-rink 4v4 reactions",
  },
  { key: "wrist", label: "Wrist shot", hint: "4-stage blade walkthrough" },
  { key: "sticks", label: "Sticks", hint: "Curves, flex, & recommendations" },
] as const;

function App() {
  const [page, setPage] = useState<PageKey>("trainer");

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "wrist" || hash === "trainer" || hash === "sticks") {
        setPage(hash);
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  useEffect(() => {
    if (window.location.hash.replace("#", "") !== page) {
      window.location.hash = page;
    }
  }, [page]);

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="brand">
          <img src={dragonLogo} alt="Euless 8U Dragons" className="logo-mark" />
          <div>
            <p className="eyebrow">Euless 8U Dragons</p>
            <h2 className="brand-title">Skill lab</h2>
            <p className="brand-subline">
              Positioning, mechanics, and other information for Dragons in one
              spot.
            </p>
          </div>
        </div>
        <nav className="nav-buttons">
          {nav.map((item) => (
            <button
              key={item.key}
              className={`nav-button ${
                page === item.key ? "nav-button-active" : ""
              }`}
              onClick={() => setPage(item.key)}
            >
              <span>{item.label}</span>
              <small>{item.hint}</small>
            </button>
          ))}
        </nav>
      </header>

      <main className="page-wrapper">
        {page === "trainer" ? (
          <PositionTrainerPage />
        ) : page === "wrist" ? (
          <WristShot />
        ) : (
          <CurvesPage />
        )}
      </main>
    </div>
  );
}

export default App;
