import { NavLink, Outlet } from "react-router-dom";
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
            <NavLink
              key={item.key}
              to={item.key === "trainer" ? "/" : `/${item.key === "sticks" ? "sticks" : "wrist"}`}
              className={({ isActive }) =>
                `nav-button ${isActive ? "nav-button-active" : ""}`
              }
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
