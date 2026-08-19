// ── 이 모듈의 가정 ─────────────────────────────────────────────
// - 동행형: 팀 전체가 한 차로 이동, 별장을 "순차" 청소 (병렬 없음)
// - 행렬 인덱스 0 = 거점, i+1 = jobs[i] (plan.js 가 보장)
// - 경유지 ≤ 8 이면 순열 완전탐색, 9곳 이상이면 최근접(NN) + 2-opt 폴백
// - 제약: 각 별장 청소 완료시각 ≤ 데드라인. 위반 순열은 큰 페널티로 처리
// - 목적함수: 총 이동시간(거점 복귀 포함) 최소
// ──────────────────────────────────────────────────────────────
import { CONFIG } from "../config.js";
import { toMin } from "./classify.js";

const DEADLINE_PENALTY = 100000; // 위반 1건당 페널티(분) — 이동시간과 비교 불가 수준

export const EXHAUSTIVE_LIMIT = 8;

/** 순서(order: 행렬 인덱스 배열)의 총 이동시간. 거점(0) 출발 → 순회 → 거점 복귀 */
export function routeTravel(order, matrix) {
  let total = 0;
  let pos = 0;
  for (const idx of order) {
    total += matrix[pos][idx];
    pos = idx;
  }
  total += matrix[pos][0];
  return total;
}

/** 순서에 따른 시각표 시뮬레이션. 페널티 포함 비용과 스케줄을 돌려준다 */
function simulateOrder(order, jobsByIdx, matrix) {
  const workStart = toMin(CONFIG.schedule.workStart);
  let t = workStart;
  let pos = 0;
  let travel = 0;
  let penalty = 0;
  const schedule = [];
  const violations = [];
  for (const idx of order) {
    const leg = matrix[pos][idx];
    t += leg;
    travel += leg;
    const job = jobsByIdx.get(idx);
    const arrive = t;
    const finish = arrive + job.est;
    if (job.deadline != null && finish > job.deadline) {
      penalty += DEADLINE_PENALTY;
      violations.push({ villaId: job.villaId, finish, deadline: job.deadline });
    }
    schedule.push({ villaId: job.villaId, arrive, finish, travelFromPrev: leg, cleanerId: null });
    t = finish;
    pos = idx;
  }
  const backLeg = matrix[pos][0];
  travel += backLeg;
  const endTime = t + backLeg;
  return { schedule, totalTravel: travel, endTime, violations, cost: travel + penalty };
}

/** 최근접 이웃 순서 (그리디 베이스라인) */
export function nearestOrder(indices, matrix, from = 0) {
  const remaining = [...indices];
  const order = [];
  let pos = from;
  while (remaining.length) {
    let bi = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (matrix[pos][remaining[i]] < matrix[pos][remaining[bi]]) bi = i;
    }
    pos = remaining.splice(bi, 1)[0];
    order.push(pos);
  }
  return order;
}

/** 2-opt 국소 개선 (비용 함수 주입) */
export function twoOptImprove(order, costFn) {
  let best = [...order];
  let bestCost = costFn(best);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const cand = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        const c = costFn(cand);
        if (c < bestCost) {
          best = cand;
          bestCost = c;
          improved = true;
        }
      }
    }
  }
  return { order: best, cost: bestCost };
}

function* permutations(arr) {
  if (arr.length <= 1) {
    yield arr;
    return;
  }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) yield [arr[i], ...p];
  }
}

/**
 * 동행형 스케줄 계산.
 * @param {Array<{idx:number, villaId:string, est:number, deadline:number|null}>} jobs
 * @param {number[][]} matrix
 */
export function solveTsp(jobs, matrix) {
  const jobsByIdx = new Map(jobs.map((j) => [j.idx, j]));
  const indices = jobs.map((j) => j.idx);
  const costOf = (order) => simulateOrder(order, jobsByIdx, matrix).cost;

  // 베이스라인: 최근접 그리디
  const nn = nearestOrder(indices, matrix);
  const nnResult = simulateOrder(nn, jobsByIdx, matrix);

  let bestOrder;
  let method;
  if (indices.length <= EXHAUSTIVE_LIMIT) {
    method = "완전탐색";
    let best = nn;
    let bestCost = nnResult.cost;
    for (const p of permutations(indices)) {
      const c = costOf(p);
      if (c < bestCost) {
        bestCost = c;
        best = [...p];
      }
    }
    bestOrder = best;
  } else {
    method = "NN+2-opt";
    bestOrder = twoOptImprove(nn, costOf).order;
  }

  const result = simulateOrder(bestOrder, jobsByIdx, matrix);
  const pct =
    nnResult.totalTravel > 0
      ? (((nnResult.totalTravel - result.totalTravel) / nnResult.totalTravel) * 100).toFixed(1)
      : "0.0";
  // 완료 기준 4: 그리디 vs 개선 후 총 이동시간 콘솔 비교
  console.log(
    `[동행형/${method}] 그리디(최근접) ${nnResult.totalTravel}분 → 개선 ${result.totalTravel}분 (개선율 ${pct}%)`
  );

  return {
    order: bestOrder,
    schedule: result.schedule,
    totalTravel: result.totalTravel,
    totalClean: jobs.reduce((s, j) => s + j.est, 0),
    endTime: result.endTime,
    violations: result.violations,
    comparison: { greedy: nnResult.totalTravel, improved: result.totalTravel, pct: Number(pct) },
    timeline: null, // 셔틀형 전용 필드 (동행형은 schedule 사용)
  };
}
