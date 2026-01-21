import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { Route } from "../models/route";
import { deleteRoute, getRoutes, upsertRoute } from "../lib/routeRepository";
import { formatDistanceKm } from "../utils/format";

const createEmptyRoute = (): Route => ({
  id: crypto.randomUUID(),
  name: "새 경로",
  polyline: [],
  waterStations: [],
  distanceMeters: 0
});

export const RoutesPage = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setRoutes(getRoutes());
  }, []);

  const handleCreate = () => {
    const route = createEmptyRoute();
    upsertRoute(route);
    navigate(`/edit/${route.id}`);
  };

  const handleDelete = (id: string) => {
    deleteRoute(id);
    setRoutes(getRoutes());
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>마라톤 경로</h1>
        <button className="primary-button" onClick={handleCreate}>
          새 경로 만들기
        </button>
      </div>

      <div className="card">
        <ul className="route-list">
          {routes.length === 0 && <p>저장된 경로가 없습니다.</p>}
          {routes.map((route) => (
            <li key={route.id} className="route-item">
              <div>
                <strong>{route.name}</strong>
                <div className="badge">{formatDistanceKm(route.distanceMeters)}</div>
              </div>
              <div className="button-row">
                <button
                  className="secondary-button"
                  onClick={() => navigate(`/edit/${route.id}`)}
                >
                  편집
                </button>
                <button
                  className="secondary-button"
                  onClick={() => navigate(`/simulate/${route.id}`)}
                >
                  시뮬레이션
                </button>
                <button
                  className="danger-button"
                  onClick={() => handleDelete(route.id)}
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
