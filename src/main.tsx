import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import PositionTrainerPage from "./pages/PositionTrainer";
import WristShot from "./pages/WristShot";
import CurvesPage from "./pages/Curves";
import StatsBoard from "./pages/StatsBoard";

const base = (import.meta as any).env?.BASE_URL || "/";

const router = createBrowserRouter(
  [
    {
      element: <App />,
      children: [
        { index: true, element: <PositionTrainerPage /> },
        { path: "wrist", element: <WristShot /> },
        { path: "sticks", element: <CurvesPage /> },
        { path: "stats", element: <StatsBoard /> },
        { path: "*", element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: base }
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
