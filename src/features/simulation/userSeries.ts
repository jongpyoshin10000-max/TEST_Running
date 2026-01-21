import type { MatchedTrackPoint } from "../upload/matchToRoute";
import type { RunnerSeries } from "./types";

const interpolate = (
  a: MatchedTrackPoint,
  b: MatchedTrackPoint,
  tSec: number
) => {
  const span = b.tSec - a.tSec || 1;
  const ratio = (tSec - a.tSec) / span;
  return {
    tSec,
    distMeters: a.distMeters + (b.distMeters - a.distMeters) * ratio,
    lat: a.lat + (b.lat - a.lat) * ratio,
    lng: a.lng + (b.lng - a.lng) * ratio
  };
};

export const buildUserSeries = (track: MatchedTrackPoint[]): RunnerSeries => {
  if (track.length === 0) {
    return { type: "user", points: [], durationSec: 0 };
  }
  const sorted = [...track].sort((a, b) => a.tSec - b.tSec);
  const durationSec = sorted[sorted.length - 1].tSec;
  const points = [] as RunnerSeries["points"];

  let cursor = 0;
  for (let t = 0; t <= durationSec; t += 1) {
    while (cursor < sorted.length - 1 && sorted[cursor + 1].tSec < t) {
      cursor += 1;
    }
    const current = sorted[cursor];
    const next = sorted[cursor + 1] ?? current;
    const interpolated = interpolate(current, next, t);
    const speedMps =
      next.tSec === current.tSec
        ? 0
        : (next.distMeters - current.distMeters) / (next.tSec - current.tSec);
    points.push({
      tSec: interpolated.tSec,
      distMeters: interpolated.distMeters,
      speedMps,
      lat: interpolated.lat,
      lng: interpolated.lng
    });
  }

  return { type: "user", points, durationSec };
};
