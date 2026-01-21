import type { UserTrackPoint } from "../../models/userActivity";

export const parseGpx = (gpxText: string): UserTrackPoint[] => {
  const parser = new DOMParser();
  const xml = parser.parseFromString(gpxText, "application/xml");
  const trkpts = Array.from(xml.getElementsByTagName("trkpt"));

  if (trkpts.length === 0) {
    throw new Error("GPX에서 트랙 포인트를 찾을 수 없습니다.");
  }

  let lastTime = 0;
  return trkpts.map((trkpt, index) => {
    const lat = Number(trkpt.getAttribute("lat"));
    const lng = Number(trkpt.getAttribute("lon"));
    const timeNode = trkpt.getElementsByTagName("time")[0];

    let tSec = index;
    if (timeNode && timeNode.textContent) {
      const parsed = Date.parse(timeNode.textContent);
      if (!Number.isNaN(parsed)) {
        tSec = Math.floor(parsed / 1000);
      }
    }

    if (index === 0) {
      lastTime = tSec;
    }

    const normalized = tSec - lastTime;
    return {
      lat,
      lng,
      tSec: normalized
    };
  });
};
