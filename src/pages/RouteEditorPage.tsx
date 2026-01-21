import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMapEvents
} from "react-leaflet";
import { useNavigate, useParams } from "react-router-dom";

import type { LatLng } from "../models/geo";
import type { Route, WaterStation } from "../models/route";
import { getRouteById, upsertRoute } from "../lib/routeRepository";
import { computePolylineDistance, projectPointToPolyline } from "../utils/geo";
import { formatDistanceKm } from "../utils/format";

const DEFAULT_CENTER: LatLng = { lat: 37.5665, lng: 126.978 };

const MapClickHandler = ({
  onClick,
  enabled
}: {
  onClick: (latlng: LatLng) => void;
  enabled: boolean;
}) => {
  useMapEvents({
    click: (event) => {
      if (!enabled) {
        return;
      }
      onClick({ lat: event.latlng.lat, lng: event.latlng.lng });
    }
  });
  return null;
};

export const RouteEditorPage = () => {
  const { routeId } = useParams();
  const navigate = useNavigate();
  const [route, setRoute] = useState<Route | null>(null);
  const [editMode, setEditMode] = useState(true);
  const [waterMode, setWaterMode] = useState(false);

  useEffect(() => {
    if (!routeId) {
      return;
    }
    const stored = getRouteById(routeId);
    setRoute(stored ?? null);
  }, [routeId]);

  useEffect(() => {
    if (!route) {
      return;
    }
    upsertRoute(route);
  }, [route]);

  const distanceMeters = useMemo(() => {
    if (!route) {
      return 0;
    }
    return computePolylineDistance(route.polyline);
  }, [route]);

  const handleMapClick = useCallback(
    (latlng: LatLng) => {
      if (!route) {
        return;
      }
      if (waterMode) {
        const projected =
          route.polyline.length > 1
            ? projectPointToPolyline(latlng, route.polyline)
            : null;
        const kmMark = projected ? projected.distAlong / 1000 : undefined;
        const newStation: WaterStation = {
          id: crypto.randomUUID(),
          lat: latlng.lat,
          lng: latlng.lng,
          label: `급수 ${route.waterStations.length + 1}`,
          kmMark
        };
        setRoute({
          ...route,
          waterStations: [...route.waterStations, newStation]
        });
        return;
      }

      const nextPolyline = [...route.polyline, latlng];
      setRoute({
        ...route,
        polyline: nextPolyline,
        distanceMeters: computePolylineDistance(nextPolyline)
      });
    },
    [route, waterMode]
  );

  const handleUndo = () => {
    if (!route || route.polyline.length === 0) {
      return;
    }
    const next = route.polyline.slice(0, -1);
    setRoute({
      ...route,
      polyline: next,
      distanceMeters: computePolylineDistance(next)
    });
  };

  const handleReset = () => {
    if (!route) {
      return;
    }
    setRoute({
      ...route,
      polyline: [],
      waterStations: [],
      distanceMeters: 0
    });
  };

  const handleSave = () => {
    if (!route) {
      return;
    }
    upsertRoute({
      ...route,
      distanceMeters
    });
    setRoute({ ...route, distanceMeters });
  };

  if (!route) {
    return <div className="page">경로를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{route.name}</h1>
          <div className="badge">총 거리: {formatDistanceKm(distanceMeters)}</div>
        </div>
        <div className="button-row">
          <button className="secondary-button" onClick={() => navigate("/routes")}> 
            목록
          </button>
          <button className="primary-button" onClick={handleSave}>
            저장
          </button>
          <button
            className="secondary-button"
            onClick={() => navigate(`/simulate/${route.id}`)}
          >
            시뮬레이션
          </button>
        </div>
      </div>

      <div className="layout-grid">
        <div className="card">
          <MapContainer
            center={route.polyline[0] ?? DEFAULT_CENTER}
            zoom={13}
            className="map-container"
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onClick={handleMapClick} enabled={editMode} />
            {route.polyline.length > 0 && (
              <Polyline positions={route.polyline} pathOptions={{ color: "#2563eb" }} />
            )}
            {route.waterStations.map((station) => (
              <CircleMarker
                key={station.id}
                center={{ lat: station.lat, lng: station.lng }}
                radius={6}
                pathOptions={{ color: "#0f766e" }}
              />
            ))}
          </MapContainer>
        </div>

        <div className="panel">
          <h3>편집 도구</h3>
          <div className="button-row">
            <button
              className={editMode ? "primary-button" : "secondary-button"}
              onClick={() => setEditMode((prev) => !prev)}
            >
              편집 모드 {editMode ? "ON" : "OFF"}
            </button>
            <button
              className={waterMode ? "primary-button" : "secondary-button"}
              onClick={() => setWaterMode((prev) => !prev)}
            >
              급수 모드 {waterMode ? "ON" : "OFF"}
            </button>
          </div>
          <div className="button-row" style={{ marginTop: 12 }}>
            <button className="secondary-button" onClick={handleUndo}>
              마지막 점 삭제
            </button>
            <button className="danger-button" onClick={handleReset}>
              전체 초기화
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <strong>급수 지점</strong>
            <ul>
              {route.waterStations.map((station) => (
                <li key={station.id}>
                  {station.label}
                  {station.kmMark ? ` (${station.kmMark.toFixed(1)}km)` : ""}
                </li>
              ))}
              {route.waterStations.length === 0 && <li>등록된 급수 없음</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
