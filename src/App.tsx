import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import dragonLogo from "./assets/Dragon.png";
import "./App.css";
const nav = [
  {
    key: "trainer",
    label: "Position trainer",
  },
  { key: "wrist", label: "Wrist shot" },
  { key: "sticks", label: "Sticks" },
] as const;

function App() {
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 900) {
        setNavOpen(true);
      } else {
        setNavOpen(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="brand-row">
          <div className="brand">
            <img src={dragonLogo} alt="Euless 8U Dragons" className="logo-mark" />
            <div>
              <p className="eyebrow">Euless 8U Dragons</p>
            </div>
          </div>
          <div className="nav-actions-mobile">
            <button
              className="nav-toggle"
              aria-label={navOpen ? "Collapse menu" : "Expand menu"}
              onClick={() => setNavOpen((o) => !o)}
            >
              {navOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
        <nav className={`nav-buttons ${navOpen ? "nav-open" : "nav-closed"}`}>
          {nav.map((item) => (
            <NavLink
              key={item.key}
              to={
                item.key === "trainer"
                  ? "/"
                  : `/${item.key === "sticks" ? "sticks" : "wrist"}`
              }
              className={({ isActive }) =>
                `nav-button ${isActive ? "nav-button-active" : ""}`
              }
              onClick={() => window.innerWidth <= 900 && setNavOpen(false)}
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="page-wrapper">
        <Outlet />
      </main>
    </div>
  );
}

export default App;
