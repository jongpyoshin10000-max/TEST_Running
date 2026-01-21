export const formatDuration = (seconds: number): string => {
  const clamped = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  return [hrs, mins, secs]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
};

export const formatDistanceKm = (meters: number): string => {
  return `${(meters / 1000).toFixed(1)}km`;
};

export const formatPace = (secPerKm: number): string => {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) {
    return "-";
  }
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}/km`;
};
