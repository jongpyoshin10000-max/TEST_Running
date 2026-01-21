import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer
} from "react-leaflet";
import { useNavigate, useParams } from "react-router-dom";

import type { LatLng } from "../models/geo";
import type { Route } from "../models/route";
import type { UserActivity } from "../models/userActivity";
import { getRouteById } from "../lib/routeRepository";
import {
  clearUserActivity,
  getUserActivity,
  saveUserActivity
} from "../lib/userActivityRepository";
import { formatDistanceKm, formatDuration, formatPace } from "../utils/format";
import { parseGpx } from "../features/upload/gpx";
import { matchTrackToRoute } from "../features/upload/matchToRoute";
import {
  buildKeyPoints,
  buildRouteCumulative,
  buildRunnerSeries,
  buildSegmentMetrics,
  createRunnerProfiles,
  formatKeyPointLabel,
  interpolateLatLngByDistance
} from "../features/simulation/utils";
import type { KeyPoint, RunnerSeries } from "../features/simulation/types";
import { buildUserSeries } from "../features/simulation/userSeries";

const DEFAULT_CENTER: LatLng = { lat: 37.5665, lng: 126.978 };

const getRunnerPositionAtTime = (series: RunnerSeries, tSec: number) => {
  if (series.points.length === 0) {
    return null;
  }
  const clamped = Math.min(tSec, series.durationSec);
  const point = series.points[clamped] ?? series.points[series.points.length - 1];
  return point;
};

const speedOptions = [1, 4, 16, 32];

export const SimulationPage = () => {
  const { routeId } = useParams();
  const navigate = useNavigate();
  const [route, setRoute] = useState<Route | null>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedKeyPoint, setSelectedKeyPoint] = useState<KeyPoint | null>(null);
  const [showUser, setShowUser] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [userActivity, setUserActivity] = useState<UserActivity | null>(null);

  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!routeId) {
      return;
    }
    const stored = getRouteById(routeId);
    setRoute(stored ?? null);
    const storedActivity = getUserActivity(routeId);
    setUserActivity(storedActivity ?? null);
  }, [routeId]);

  const runnerSeries = useMemo(() => {
    if (!route) {
      return [];
    }
    return buildRunnerSeries(route);
  }, [route]);

  const userSeries = useMemo(() => {
    if (!route || !userActivity) {
      return null;
    }
    const matched = matchTrackToRoute(userActivity.points, route.polyline);
    return buildUserSeries(matched);
  }, [route, userActivity]);

  const durationSec = useMemo(() => {
    const durations = runnerSeries.map((runner) => runner.durationSec);
    if (userSeries) {
      durations.push(userSeries.durationSec);
    }
    return durations.length > 0 ? Math.max(...durations) : 0;
  }, [runnerSeries, userSeries]);

  const keyPoints = useMemo(() => {
    if (!route) {
      return [];
    }
    return buildKeyPoints(route);
  }, [route]);

  const routeCumulative = useMemo(() => {
    if (!route) {
      return null;
    }
    return buildRouteCumulative(route.polyline);
  }, [route]);

  const segmentMetrics = useMemo(() => {
    if (!runnerSeries.length) {
      return [];
    }
    return buildSegmentMetrics(
      userSeries ? [...runnerSeries, userSeries] : runnerSeries,
      keyPoints
    );
  }, [runnerSeries, userSeries, keyPoints]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    let frameId = 0;

    const tick = (timestamp: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = timestamp;
      }
      const deltaMs = timestamp - lastFrameRef.current;
      lastFrameRef.current = timestamp;
      const dtSec = (deltaMs / 1000) * playbackSpeed;

      setCurrentTimeSec((prev) => {
        const next = Math.min(durationSec, prev + dtSec);
        if (next >= durationSec) {
          setPlaying(false);
        }
        return next;
      });

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      lastFrameRef.current = null;
    };
  }, [playing, playbackSpeed, durationSec]);

  const handleSliderChange = (value: number) => {
    setCurrentTimeSec(value);
  };

  const handleKeyPointSelect = (keyPoint: KeyPoint) => {
    setSelectedKeyPoint(keyPoint);
    const targetMetric = segmentMetrics.find(
      (metric) => metric.keyPointId === keyPoint.id && metric.runnerType === "amateur"
    );
    if (targetMetric) {
      setCurrentTimeSec(targetMetric.passTimeSec);
    }
  };

  const handleGpxUpload = async (file: File) => {
    try {
      setUploadError(null);
      const text = await file.text();
      const points = parseGpx(text);
      const durationSec = points.length ? points[points.length - 1].tSec : 0;
      const activity: UserActivity = {
        routeId: routeId ?? "",
        points,
        durationSec
      };
      saveUserActivity(activity);
      setUserActivity(activity);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "GPX 파일을 읽을 수 없습니다."
      );
    }
  };

  const handleClearUser = () => {
    if (!routeId) {
      return;
    }
    clearUserActivity(routeId);
    setUserActivity(null);
  };

  if (!route) {
    return <div className="page">경로를 찾을 수 없습니다.</div>;
  }

  if (route.polyline.length < 2) {
    return (
      <div className="page">
        <p>경로에 최소 2개의 점이 필요합니다.</p>
        <button className="secondary-button" onClick={() => navigate(`/edit/${route.id}`)}>
          경로 편집으로 이동
        </button>
      </div>
    );
  }

  const profiles = createRunnerProfiles();
  const activeRunners = profiles.map((profile) => {
    const series = runnerSeries.find((runner) => runner.type === profile.type);
    return {
      profile,
      position: series ? getRunnerPositionAtTime(series, Math.floor(currentTimeSec)) : null
    };
  });

  const userPosition = userSeries ? getRunnerPositionAtTime(userSeries, Math.floor(currentTimeSec)) : null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{route.name} 시뮬레이션</h1>
          <div className="badge">총 거리: {formatDistanceKm(route.distanceMeters)}</div>
        </div>
        <div className="button-row">
          <button className="secondary-button" onClick={() => navigate("/routes")}>
            목록
          </button>
          <button className="secondary-button" onClick={() => navigate(`/edit/${route.id}`)}>
            편집
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
            <Polyline positions={route.polyline} pathOptions={{ color: "#2563eb" }} />
            {keyPoints.map((keyPoint) => {
              const point = routeCumulative
                ? interpolateLatLngByDistance(
                    routeCumulative.points,
                    routeCumulative.cumulativeMeters,
                    keyPoint.distMeters
                  )
                : DEFAULT_CENTER;
              return (
                <CircleMarker
                  key={keyPoint.id}
                  center={point}
                  radius={6}
                  pathOptions={{ color: keyPoint.type === "water" ? "#0f766e" : "#64748b" }}
                  eventHandlers={{
                    click: () => handleKeyPointSelect(keyPoint)
                  }}
                />
              );
            })}
            {activeRunners.map(({ profile, position }) =>
              position ? (
                <CircleMarker
                  key={profile.type}
                  center={{ lat: position.lat, lng: position.lng }}
                  radius={8}
                  pathOptions={{ color: profile.color, fillOpacity: 0.9 }}
                />
              ) : null
            )}
            {showUser && userPosition && (
              <CircleMarker
                center={{ lat: userPosition.lat, lng: userPosition.lng }}
                radius={10}
                pathOptions={{ color: "#a855f7", fillOpacity: 0.9 }}
              />
            )}
          </MapContainer>

          <div className="control-bar">
            <button
              className="primary-button"
              onClick={() => setPlaying((prev) => !prev)}
            >
              {playing ? "일시정지" : "재생"}
            </button>
            {speedOptions.map((speed) => (
              <button
                key={speed}
                className={speed === playbackSpeed ? "primary-button" : "secondary-button"}
                onClick={() => setPlaybackSpeed(speed)}
              >
                {speed}x
              </button>
            ))}
            <div style={{ minWidth: 160 }}>
              <input
                className="slider"
                type="range"
                min={0}
                max={durationSec}
                value={currentTimeSec}
                onChange={(event) => handleSliderChange(Number(event.target.value))}
              />
            </div>
            <div className="badge">{formatDuration(currentTimeSec)}</div>
          </div>
        </div>

        <div className="panel">
          <h3>러너 상태</h3>
          {activeRunners.map(({ profile, position }) => (
            <div key={profile.type} style={{ marginBottom: 12 }}>
              <strong style={{ color: profile.color }}>{profile.label}</strong>
              <div>거리: {formatDistanceKm(position?.distMeters ?? 0)}</div>
              <div>페이스: {formatPace(position ? 1000 / Math.max(position.speedMps, 0.1) : 0)}</div>
              <div>시간: {formatDuration(currentTimeSec)}</div>
            </div>
          ))}
          {userPosition && (
            <div style={{ marginBottom: 12 }}>
              <strong style={{ color: "#a855f7" }}>사용자</strong>
              <div>거리: {formatDistanceKm(userPosition.distMeters)}</div>
              <div>페이스: {formatPace(1000 / Math.max(userPosition.speedMps, 0.1))}</div>
              <div>시간: {formatDuration(currentTimeSec)}</div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <h3>내 기록 업로드</h3>
            <input
              type="file"
              accept=".gpx"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  handleGpxUpload(file);
                }
              }}
            />
            <div className="inline-field" style={{ marginTop: 8 }}>
              <label>
                <input
                  type="checkbox"
                  checked={showUser}
                  onChange={(event) => setShowUser(event.target.checked)}
                />{" "}
                내 기록 표시
              </label>
              {userActivity && (
                <button className="secondary-button" onClick={handleClearUser}>
                  기록 삭제
                </button>
              )}
            </div>
            {uploadError && <div className="notice">{uploadError}</div>}
          </div>

          <div style={{ marginTop: 16 }}>
            <h3>KeyPoint</h3>
            <div className="keypoint-list">
              {keyPoints.map((keyPoint) => (
                <div
                  key={keyPoint.id}
                  className={`keypoint-item ${
                    selectedKeyPoint?.id === keyPoint.id ? "active" : ""
                  }`}
                  onClick={() => handleKeyPointSelect(keyPoint)}
                >
                  {formatKeyPointLabel(keyPoint)}
                </div>
              ))}
            </div>
          </div>

          {selectedKeyPoint && (
            <div style={{ marginTop: 16 }}>
              <h3>구간 지표 - {selectedKeyPoint.label}</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>러너</th>
                    <th>평균 속도</th>
                    <th>최고 속도</th>
                    <th>페이스</th>
                    <th>통과시간</th>
                  </tr>
                </thead>
                <tbody>
                  {segmentMetrics
                    .filter((metric) => metric.keyPointId === selectedKeyPoint.id)
                    .map((metric) => (
                      <tr key={`${metric.keyPointId}-${metric.runnerType}`}>
                        <td>{metric.runnerType}</td>
                        <td>{metric.segmentAvgSpeedMps.toFixed(2)} m/s</td>
                        <td>{metric.segmentMaxSpeedMps.toFixed(2)} m/s</td>
                        <td>{formatPace(metric.segmentPaceSecPerKm)}</td>
                        <td>{formatDuration(metric.passTimeSec)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
