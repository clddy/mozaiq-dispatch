// ── 이 모듈의 가정 ─────────────────────────────────────────────
// - 화면과 bundle.js 가 공유하는 오케스트레이터 (지시서 외 추가 모듈)
// - 행렬 인덱스 규약: 0 = 거점, i+1 = jobs[i] — tsp/shuttle 이 이 규약에 의존
// - 이동시간은 travel.js 의 buildTravelMatrix 를 통해서만 획득
// ──────────────────────────────────────────────────────────────
import { buildTravelMatrix } from "./travel.js";
import { solveTsp } from "./tsp.js";
import { solveShuttle } from "./shuttle.js";

/**
 * 모드별 배차 계산.
 * @param {"shuttle"|"companion"} mode
 * @param {Array<{villaId:string, villa:object, est:number, deadline:number|null}>} jobs
 * @param {{lat:number, lng:number}} depot
 * @param {number} crewSize
 */
export async function computePlan(mode, jobs, depot, crewSize) {
  if (!jobs.length) return null;
  const points = [depot, ...jobs.map((j) => j.villa)];
  const matrix = await buildTravelMatrix(points);
  const solverJobs = jobs.map((j, i) => ({ ...j, idx: i + 1 }));
  const solved =
    mode === "companion"
      ? solveTsp(solverJobs, matrix)
      : solveShuttle(solverJobs, matrix, { crewSize });
  return { mode, jobs, depot, matrix, ...solved };
}
