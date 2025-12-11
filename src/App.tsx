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

  const pathToPage = (path: string): PageKey => {
    if (path.startsWith("/wrist")) return "wrist";
    if (path.startsWith("/sticks")) return "sticks";
    return "trainer";
  };

  const pageToPath = (p: PageKey) => {
    if (p === "wrist") return "/wrist";
    if (p === "sticks") return "/sticks";
    return "/";
  };

  useEffect(() => {
    const applyPath = () => {
      const current = pathToPage(window.location.pathname);
      setPage(current);
    };
    applyPath();
    window.addEventListener("popstate", applyPath);
    return () => window.removeEventListener("popstate", applyPath);
  }, []);

  useEffect(() => {
    const desired = pageToPath(page);
    if (window.location.pathname !== desired) {
      window.history.pushState({}, "", desired);
    }
  }, [page]);

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="brand">
          <img src={dragonLogo} alt="Euless 8U Dragons" className="logo-mark" />
          <div>
            <p className="eyebrow">Euless 8U Dragons</p>
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
