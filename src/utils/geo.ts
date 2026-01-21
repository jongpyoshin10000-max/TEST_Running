import type { LatLng } from "../models/geo";

const EARTH_RADIUS = 6371000;

export const haversineDistance = (a: LatLng, b: LatLng): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
};

export const computePolylineDistance = (points: LatLng[]): number => {
  if (points.length < 2) {
    return 0;
  }
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineDistance(points[i - 1], points[i]);
  }
  return total;
};

const toRadians = (value: number) => (value * Math.PI) / 180;
const toDegrees = (value: number) => (value * 180) / Math.PI;

const latLngToMeters = (origin: LatLng, point: LatLng) => {
  const latFactor = EARTH_RADIUS;
  const lngFactor = EARTH_RADIUS * Math.cos(toRadians(origin.lat));
  return {
    x: toRadians(point.lng - origin.lng) * lngFactor,
    y: toRadians(point.lat - origin.lat) * latFactor
  };
};

const metersToLatLng = (origin: LatLng, vector: { x: number; y: number }) => {
  const latFactor = EARTH_RADIUS;
  const lngFactor = EARTH_RADIUS * Math.cos(toRadians(origin.lat));
  return {
    lat: origin.lat + toDegrees(vector.y / latFactor),
    lng: origin.lng + toDegrees(vector.x / lngFactor)
  };
};

export const projectPointToSegment = (
  point: LatLng,
  start: LatLng,
  end: LatLng
): { projected: LatLng; t: number; distance: number } => {
  const origin = start;
  const startVec = latLngToMeters(origin, start);
  const endVec = latLngToMeters(origin, end);
  const pointVec = latLngToMeters(origin, point);

  const dx = endVec.x - startVec.x;
  const dy = endVec.y - startVec.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return {
      projected: start,
      t: 0,
      distance: Math.hypot(pointVec.x - startVec.x, pointVec.y - startVec.y)
    };
  }

  let t =
    ((pointVec.x - startVec.x) * dx + (pointVec.y - startVec.y) * dy) /
    lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const projectedVec = { x: startVec.x + dx * t, y: startVec.y + dy * t };
  const projected = metersToLatLng(origin, projectedVec);

  return {
    projected,
    t,
    distance: Math.hypot(pointVec.x - projectedVec.x, pointVec.y - projectedVec.y)
  };
};

export const projectPointToPolyline = (
  point: LatLng,
  polyline: LatLng[]
): { projected: LatLng; distAlong: number; distance: number } => {
  if (polyline.length === 0) {
    return { projected: point, distAlong: 0, distance: 0 };
  }
  if (polyline.length === 1) {
    return {
      projected: polyline[0],
      distAlong: 0,
      distance: haversineDistance(point, polyline[0])
    };
  }

  let best = {
    projected: polyline[0],
    distAlong: 0,
    distance: Number.POSITIVE_INFINITY
  };
  let runningDist = 0;

  for (let i = 1; i < polyline.length; i += 1) {
    const start = polyline[i - 1];
    const end = polyline[i];
    const segmentLength = haversineDistance(start, end);
    const projection = projectPointToSegment(point, start, end);
    const distAlong = runningDist + segmentLength * projection.t;

    if (projection.distance < best.distance) {
      best = {
        projected: projection.projected,
        distAlong,
        distance: projection.distance
      };
    }

    runningDist += segmentLength;
  }

  return best;
};
