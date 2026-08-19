// ── 이 모듈의 가정 ─────────────────────────────────────────────
// - 셔틀형: 기사 1명이 청소부를 드롭/픽업, 청소는 각 별장에서 병렬 진행
// - 별장당 청소부 1명 (CONFIG.shuttle.cleanersPerVilla, v0 고정)
// - crewSize ≤ vehicleCapacity 를 전제 (초과분은 첫 라운드에서 탑승 제한)
// - 완료시각 = 청소 종료 시각(ready). 픽업 지연은 데드라인 판정과 무관
// - 휴리스틱: ①데드라인 우선 정렬 ②드롭 라운드 NN+2-opt ③earliest-ready
//   픽업 & 즉시 재드롭 ④위반 시 해당 별장 선두 이동 후 1회 재계산
// - 행렬 인덱스 0 = 거점, i+1 = jobs[i] (plan.js 가 보장)
// ──────────────────────────────────────────────────────────────
import { CONFIG } from "../config.js";
import { toMin } from "./classify.js";
import { nearestOrder, twoOptImprove } from "./tsp.js";

/** 드롭 배치 순서의 이동시간 (거점→…, 복귀 없음) */
function pathTravel(order, matrix, from = 0) {
  let total = 0;
  let pos = from;
  for (const idx of order) {
    total += matrix[pos][idx];
    pos = idx;
  }
  return total;
}

/**
 * 우선순위 순서(priority)를 받아 셔틀 스케줄 1회 시뮬레이션.
 * useTwoOpt=false 면 드롭 라운드를 최근접 그리디로만 돈다 (비교용).
 */
function simulate(priority, matrix, opts, useTwoOpt) {
  const cap = CONFIG.shuttle.vehicleCapacity;
  const crew = Math.max(1, opts.crewSize);
  const workStart = toMin(CONFIG.schedule.workStart);
  const workEnd = toMin(CONFIG.schedule.workEnd);

  // 시뮬레이션 간 오염 방지를 위해 잡 복제
  const jobs = priority.map((j) => ({ ...j }));
  const timeline = [];
  let t = workStart;
  let pos = 0;
  let totalTravel = 0;

  timeline.push({ time: t, action: "depart", villaId: null, cleanerId: null });

  // ── 드롭 라운드: 첫 배치(청소부 수·정원 한도) 최근접 순회 (+2-opt)
  const queue = [...jobs];
  const batchSize = Math.min(crew, cap, queue.length);
  const batch = queue.splice(0, batchSize);
  const byIdx = new Map(jobs.map((j) => [j.idx, j]));
  let dropOrder = nearestOrder(batch.map((j) => j.idx), matrix);
  if (useTwoOpt) {
    dropOrder = twoOptImprove(dropOrder, (o) => pathTravel(o, matrix)).order;
  }

  const inProgress = [];
  let nextCleaner = 0;
  for (const idx of dropOrder) {
    const job = byIdx.get(idx);
    const leg = matrix[pos][idx];
    t += leg;
    totalTravel += leg;
    pos = idx;
    job.cleanerId = nextCleaner++;
    job.dropTime = t;
    job.ready = t + job.est;
    timeline.push({ time: t, action: "drop", villaId: job.villaId, cleanerId: job.cleanerId });
    inProgress.push(job);
  }

  // ── 픽업 순회: 픽업 가능 시각이 가장 빠른 별장부터, 미배치 잡 있으면 즉시 재드롭
  while (inProgress.length) {
    inProgress.sort((a, b) => a.ready - b.ready);
    const job = inProgress.shift();
    const leg = matrix[pos][job.idx];
    const arrive = t + leg;
    totalTravel += leg;
    pos = job.idx;
    if (arrive < job.ready) {
      // 기사 대기: 공백 슬롯 명시 생성
      timeline.push({
        time: arrive,
        action: "wait",
        villaId: job.villaId,
        cleanerId: null,
        minutes: job.ready - arrive,
      });
      t = job.ready;
    } else {
      t = arrive;
    }
    timeline.push({ time: t, action: "pickup", villaId: job.villaId, cleanerId: job.cleanerId });

    if (queue.length) {
      // 재드롭 대상: 데드라인 우선, 동률이면 현재 위치에서 최근접
      queue.sort(
        (a, b) =>
          (a.deadline ?? Infinity) - (b.deadline ?? Infinity) ||
          matrix[pos][a.idx] - matrix[pos][b.idx]
      );
      const nj = queue.shift();
      const leg2 = matrix[pos][nj.idx];
      t += leg2;
      totalTravel += leg2;
      pos = nj.idx;
      nj.cleanerId = job.cleanerId; // 방금 픽업한 청소부를 재투입
      nj.dropTime = t;
      nj.ready = t + nj.est;
      timeline.push({ time: t, action: "drop", villaId: nj.villaId, cleanerId: nj.cleanerId });
      inProgress.push(nj);
    }
  }

  // ── 거점 복귀
  const backLeg = matrix[pos][0];
  t += backLeg;
  totalTravel += backLeg;
  timeline.push({ time: t, action: "return", villaId: null, cleanerId: null });

  const violations = jobs
    .filter(
      (j) =>
        (j.deadline != null && j.ready > j.deadline) || j.ready > workEnd
    )
    .map((j) => ({
      villaId: j.villaId,
      finish: j.ready,
      deadline: j.deadline != null && j.ready > j.deadline ? j.deadline : workEnd,
    }));

  // 청소부별 배정 수 (피로도 자동 체크용)
  const perCleaner = {};
  for (const j of jobs) {
    if (j.cleanerId == null) continue;
    perCleaner[j.cleanerId] = (perCleaner[j.cleanerId] ?? 0) + 1;
  }

  // 일정 여유(slack): 데드라인 있는 잡의 최소 여유분
  const slacks = jobs
    .filter((j) => j.deadline != null)
    .map((j) => j.deadline - j.ready);
  const minSlack = slacks.length ? Math.min(...slacks) : null;

  return {
    timeline,
    jobs,
    totalTravel,
    endTime: t,
    violations,
    perCleaner,
    minSlack,
    totalWait: timeline
      .filter((e) => e.action === "wait")
      .reduce((s, e) => s + e.minutes, 0),
  };
}

/**
 * 셔틀형 스케줄 계산 (핵심 모듈).
 * @param {Array<{idx:number, villaId:string, est:number, deadline:number|null}>} jobs
 * @param {number[][]} matrix
 * @param {{crewSize:number}} opts
 */
export function solveShuttle(jobs, matrix, opts) {
  // 1. 데드라인 있는 별장 우선, 동률이면 청소시간 긴 순
  const priority = [...jobs].sort(
    (a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity) || b.est - a.est
  );

  // 완료 기준 4: 그리디(최근접만) vs 2-opt 총 이동시간 콘솔 비교
  const greedy = simulate(priority, matrix, opts, false);
  let result = simulate(priority, matrix, opts, true);
  const pct =
    greedy.totalTravel > 0
      ? (((greedy.totalTravel - result.totalTravel) / greedy.totalTravel) * 100).toFixed(1)
      : "0.0";
  console.log(
    `[셔틀형] 그리디(최근접) ${greedy.totalTravel}분 → 2-opt ${result.totalTravel}분 (개선율 ${pct}%)`
  );

  // 5. 데드라인 위반 시: 위반 별장을 드롭 순서 선두로 당겨 1회 재계산
  if (result.violations.length) {
    const violatedIds = new Set(result.violations.map((v) => v.villaId));
    const reordered = [
      ...priority.filter((j) => violatedIds.has(j.villaId)),
      ...priority.filter((j) => !violatedIds.has(j.villaId)),
    ];
    const retry = simulate(reordered, matrix, opts, true);
    if (retry.violations.length < result.violations.length) {
      result = retry;
    }
    // 그래도 위반이 남으면 결과에 경고로 노출 (숨기지 않음)
  }

  return {
    order: result.jobs.map((j) => j.idx),
    schedule: result.jobs.map((j) => ({
      villaId: j.villaId,
      arrive: j.dropTime,
      finish: j.ready,
      cleanerId: j.cleanerId,
    })),
    timeline: result.timeline,
    totalTravel: result.totalTravel,
    totalClean: jobs.reduce((s, j) => s + j.est, 0),
    endTime: result.endTime,
    violations: result.violations,
    perCleaner: result.perCleaner,
    minSlack: result.minSlack,
    totalWait: result.totalWait,
    comparison: { greedy: greedy.totalTravel, improved: result.totalTravel, pct: Number(pct) },
  };
}
