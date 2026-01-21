import type { LatLng } from "../../models/geo";

export type RunnerType = "pro" | "amateur" | "casual" | "user";

export type RunnerProfile = {
  type: Exclude<RunnerType, "user">;
  label: string;
  basePaceSecPerKm: number;
  color: string;
};

export type RunnerState = {
  type: RunnerType;
  distMeters: number;
  lat: number;
  lng: number;
  speedMps: number;
};

export type RunnerSeriesPoint = {
  tSec: number;
  distMeters: number;
  speedMps: number;
  lat: number;
  lng: number;
};

export type RunnerSeries = {
  type: RunnerType;
  points: RunnerSeriesPoint[];
  durationSec: number;
};

export type KeyPointType = "km" | "water";

export type KeyPoint = {
  id: string;
  type: KeyPointType;
  label: string;
  distMeters: number;
};

export type SegmentMetrics = {
  keyPointId: string;
  runnerType: RunnerType;
  segmentAvgSpeedMps: number;
  segmentMaxSpeedMps: number;
  segmentPaceSecPerKm: number;
  passTimeSec: number;
};

export type SimulationData = {
  durationSec: number;
  runners: RunnerSeries[];
  keyPoints: KeyPoint[];
  segmentMetrics: SegmentMetrics[];
};

export type RouteCumulative = {
  points: LatLng[];
  cumulativeMeters: number[];
};
