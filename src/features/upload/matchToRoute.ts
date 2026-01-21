import type { LatLng } from "../../models/geo";
import type { UserTrackPoint } from "../../models/userActivity";
import { projectPointToPolyline } from "../../utils/geo";

export type MatchedTrackPoint = {
  tSec: number;
  distMeters: number;
  lat: number;
  lng: number;
};

// 각 트랙 포인트를 경로 polyline의 최근접 구간으로 투영해 누적거리 기반으로 매칭
export const matchTrackToRoute = (
  track: UserTrackPoint[],
  polyline: LatLng[]
): MatchedTrackPoint[] => {
  if (polyline.length < 2) {
    return track.map((point) => ({
      tSec: point.tSec,
      distMeters: 0,
      lat: point.lat,
      lng: point.lng
    }));
  }

  return track.map((point) => {
    const projected = projectPointToPolyline(
      { lat: point.lat, lng: point.lng },
      polyline
    );
    return {
      tSec: point.tSec,
      distMeters: projected.distAlong,
      lat: projected.projected.lat,
      lng: projected.projected.lng
    };
  });
};
