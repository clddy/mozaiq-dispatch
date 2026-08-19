// ── 이 모듈의 가정 ─────────────────────────────────────────────
// - v0 이동시간 = 하버사인 직선거리 × roadFactor 를 avgSpeedKmh 로 주행한 시간
// - 좌표는 지역 단위 근사(coord_precision: "region")이므로 ±10분 오차 감수
// - 카카오맵 API 교체 시 travelMinutes 본문만 바꾼다 (시그니처 유지, async)
// - 모든 스케줄러는 buildTravelMatrix 를 통해서만 이동시간을 얻는다
// ──────────────────────────────────────────────────────────────
import { CONFIG } from "../config.js";

const EARTH_RADIUS_KM = 6371;

function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s));
}

/**
 * 두 지점 간 이동시간(분). 카카오맵 API 교체 지점 — 이 함수만 바꾸면 된다.
 * @param {{lat:number, lng:number}} a
 * @param {{lat:number, lng:number}} b
 * @returns {Promise<number>} 분 (정수 반올림)
 */
export async function travelMinutes(a, b) {
  const km = haversineKm(a, b) * CONFIG.travel.roadFactor;
  return Math.round((km / CONFIG.travel.avgSpeedKmh) * 60);
}

/**
 * 지점 배열의 대칭 이동시간 행렬. 스케줄러(tsp/shuttle)는 이 행렬만 사용한다.
 * @param {Array<{lat:number, lng:number}>} points
 * @returns {Promise<number[][]>}
 */
export async function buildTravelMatrix(points) {
  const n = points.length;
  const m = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const t = await travelMinutes(points[i], points[j]);
      m[i][j] = t;
      m[j][i] = t;
    }
  }
  return m;
}
