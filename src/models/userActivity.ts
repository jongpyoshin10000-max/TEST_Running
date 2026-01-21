import type { LatLng } from "./geo";

export type UserTrackPoint = LatLng & {
  tSec: number;
};

export type UserActivity = {
  routeId: string;
  points: UserTrackPoint[];
  durationSec: number;
};
