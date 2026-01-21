import type { LatLng } from "../../models/geo";
import type { Route, WaterStation } from "../../models/route";
import { formatDistanceKm } from "../../utils/format";
import { haversineDistance, projectPointToPolyline } from "../../utils/geo";
import type {
  KeyPoint,
  RunnerProfile,
  RunnerSeries,
  RunnerSeriesPoint,
  SegmentMetrics
} from "./types";

const MARATHON_DISTANCE = 42195;

export const buildRouteCumulative = (points: LatLng[]) => {
  const cumulativeMeters: number[] = [];
  let total = 0;
  points.forEach((point, index) => {
    if (index === 0) {
      cumulativeMeters.push(0);
      return;
    }
    total += haversineDistance(points[index - 1], point);
    cumulativeMeters.push(total);
  });
  return { points, cumulativeMeters };
};

export const interpolateLatLngByDistance = (
  points: LatLng[],
  cumulativeMeters: number[],
  distMeters: number
): LatLng => {
  if (points.length === 0) {
    return { lat: 0, lng: 0 };
  }
  if (points.length === 1 || distMeters <= 0) {
    return points[0];
  }
  const clamped = Math.min(distMeters, cumulativeMeters[cumulativeMeters.length - 1]);
  let idx = cumulativeMeters.findIndex((value) => value >= clamped);
  if (idx === -1) {
    return points[points.length - 1];
  }
  if (idx === 0) {
    return points[0];
  }
  const prev = points[idx - 1];
  const next = points[idx];
  const prevDist = cumulativeMeters[idx - 1];
  const nextDist = cumulativeMeters[idx];
  const segment = nextDist - prevDist || 1;
  const ratio = (clamped - prevDist) / segment;
  return {
    lat: prev.lat + (next.lat - prev.lat) * ratio,
    lng: prev.lng + (next.lng - prev.lng) * ratio
  };
};

export const createRunnerProfiles = (): RunnerProfile[] => [
  { type: "pro", label: "프로", basePaceSecPerKm: 210, color: "#16a34a" },
  { type: "amateur", label: "아마", basePaceSecPerKm: 330, color: "#2563eb" },
  { type: "casual", label: "일반", basePaceSecPerKm: 450, color: "#f97316" }
];

const mulberry32 = (seed: number) => {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const buildRandomFactors = (seed: number, maxKm: number) => {
  const rand = mulberry32(seed);
  const factors: number[] = [];
  for (let km = 0; km <= maxKm; km += 1) {
    const value = 0.98 + rand() * 0.04;
    factors.push(value);
  }
  return factors;
};

const computeFatigueFactor = (distMeters: number) => {
  if (distMeters <= 30000) {
    return 1;
  }
  const clamped = Math.min(distMeters, MARATHON_DISTANCE);
  const ratio = (clamped - 30000) / (MARATHON_DISTANCE - 30000);
  return 1 - ratio * 0.08;
};

const buildWaterStationDistances = (route: Route): number[] => {
  return route.waterStations.map((station) =>
    projectPointToPolyline({ lat: station.lat, lng: station.lng }, route.polyline)
      .distAlong
  );
};

const computeSpeedMps = ({
  baseSpeed,
  fatigueFactor,
  randomFactor,
  waterPenalty
}: {
  baseSpeed: number;
  fatigueFactor: number;
  randomFactor: number;
  waterPenalty: number;
}) => {
  return baseSpeed * fatigueFactor * randomFactor * waterPenalty;
};

export const buildRunnerSeries = (route: Route): RunnerSeries[] => {
  const { points, cumulativeMeters } = buildRouteCumulative(route.polyline);
  const totalDistance = cumulativeMeters[cumulativeMeters.length - 1] ?? 0;
  if (totalDistance <= 0 || points.length < 2) {
    return [];
  }
  const profiles = createRunnerProfiles();
  const waterDistances = buildWaterStationDistances(route);
  const maxKm = Math.ceil(totalDistance / 1000);

  return profiles.map((profile, index) => {
    const baseSpeed = 1000 / profile.basePaceSecPerKm;
    const randomFactors = buildRandomFactors(100 + index * 1000, maxKm);
    let distMeters = 0;
    let tSec = 0;
    let waterPenaltyRemaining = 0;

    const pointsSeries: RunnerSeriesPoint[] = [];

    while (distMeters < totalDistance) {
      const kmIndex = Math.floor(distMeters / 1000);
      const randomFactor = randomFactors[kmIndex] ?? 1;
      const fatigueFactor = computeFatigueFactor(distMeters);

      if (waterPenaltyRemaining <= 0) {
        const nearWater = waterDistances.some(
          (waterDist) => Math.abs(waterDist - distMeters) <= 50
        );
        if (nearWater) {
          waterPenaltyRemaining = 8;
        }
      }

      const waterPenalty = waterPenaltyRemaining > 0 ? 0.85 : 1;
      const speedMps = computeSpeedMps({
        baseSpeed,
        fatigueFactor,
        randomFactor,
        waterPenalty
      });

      const position = interpolateLatLngByDistance(points, cumulativeMeters, distMeters);
      pointsSeries.push({
        tSec,
        distMeters,
        speedMps,
        lat: position.lat,
        lng: position.lng
      });

      distMeters += speedMps;
      tSec += 1;
      waterPenaltyRemaining = Math.max(0, waterPenaltyRemaining - 1);
    }

    const finalPosition = interpolateLatLngByDistance(points, cumulativeMeters, totalDistance);
    pointsSeries.push({
      tSec,
      distMeters: totalDistance,
      speedMps: 0,
      lat: finalPosition.lat,
      lng: finalPosition.lng
    });

    return {
      type: profile.type,
      points: pointsSeries,
      durationSec: tSec
    };
  });
};

export const buildKeyPoints = (route: Route): KeyPoint[] => {
  const totalDistance = route.distanceMeters;
  const kmPoints: KeyPoint[] = [];
  const maxKm = Math.floor(totalDistance / 1000);

  for (let km = 1; km <= maxKm; km += 1) {
    kmPoints.push({
      id: `km-${km}`,
      type: "km",
      label: `${km}km`,
      distMeters: km * 1000
    });
  }

  const waterPoints = route.waterStations.map((station: WaterStation, index) => {
    const projection = projectPointToPolyline(
      { lat: station.lat, lng: station.lng },
      route.polyline
    );
    return {
      id: `water-${station.id}`,
      type: "water",
      label: station.label || `급수 ${index + 1}`,
      distMeters: projection.distAlong
    };
  });

  return [...kmPoints, ...waterPoints].sort((a, b) => a.distMeters - b.distMeters);
};

const findPassTimeSec = (series: RunnerSeries, distMeters: number): number => {
  const found = series.points.find((point) => point.distMeters >= distMeters);
  return found ? found.tSec : series.durationSec;
};

const computeSegmentMaxSpeed = (
  series: RunnerSeries,
  startSec: number,
  endSec: number
): number => {
  if (endSec <= startSec) {
    return 0;
  }
  let max = 0;
  for (let t = startSec; t <= endSec; t += 1) {
    const point = series.points.find((p) => p.tSec === t);
    if (point) {
      max = Math.max(max, point.speedMps);
    }
  }
  return max;
};

export const buildSegmentMetrics = (
  runners: RunnerSeries[],
  keyPoints: KeyPoint[]
): SegmentMetrics[] => {
  const metrics: SegmentMetrics[] = [];
  const extendedKeyPoints = [
    { id: "start", type: "km" as const, label: "출발", distMeters: 0 },
    ...keyPoints
  ];

  runners.forEach((runner) => {
    for (let i = 1; i < extendedKeyPoints.length; i += 1) {
      const prev = extendedKeyPoints[i - 1];
      const current = extendedKeyPoints[i];
      const startTime = findPassTimeSec(runner, prev.distMeters);
      const endTime = findPassTimeSec(runner, current.distMeters);
      const timeDelta = Math.max(1, endTime - startTime);
      const distDelta = current.distMeters - prev.distMeters;
      const avgSpeed = distDelta / timeDelta;
      const maxSpeed = computeSegmentMaxSpeed(runner, startTime, endTime);
      const pace = avgSpeed > 0 ? 1000 / avgSpeed : 0;

      metrics.push({
        keyPointId: current.id,
        runnerType: runner.type,
        segmentAvgSpeedMps: avgSpeed,
        segmentMaxSpeedMps: maxSpeed,
        segmentPaceSecPerKm: pace,
        passTimeSec: endTime
      });
    }
  });

  return metrics;
};

export const formatKeyPointLabel = (keyPoint: KeyPoint) => {
  if (keyPoint.type === "km") {
    return keyPoint.label;
  }
  return `${keyPoint.label} (${formatDistanceKm(keyPoint.distMeters)})`;
};
