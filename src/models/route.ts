import type { LatLng } from "./geo";

export type WaterStation = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kmMark?: number;
};

export type Route = {
  id: string;
  name: string;
  polyline: LatLng[];
  waterStations: WaterStation[];
  distanceMeters: number;
};
