import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { RoutesPage } from "../pages/RoutesPage";
import { RouteEditorPage } from "../pages/RouteEditorPage";
import { SimulationPage } from "../pages/SimulationPage";

export const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/routes" replace />} />
        <Route path="/routes" element={<RoutesPage />} />
        <Route path="/edit/:routeId" element={<RouteEditorPage />} />
        <Route path="/simulate/:routeId" element={<SimulationPage />} />
      </Routes>
    </BrowserRouter>
  );
};
