// ── 이 모듈의 가정 ─────────────────────────────────────────────
// - 묶어가기 후보 = 오늘 배차에 없는 유예(DEFERRABLE) 별장
// - detour = 후보 포함 재계산 비용 − 기존 비용 (해당 모드 스케줄러 재사용)
// - solo = 거점→후보→거점 왕복 이동시간 (travelMinutes 경유)
// - 추천 조건: detour < solo × threshold
//   AND 전체 일정 workEnd 내 완료 AND 기존 별장 데드라인 신규 위반 0건
// - 셔틀형의 wait 슬롯 활용은 재계산 자체가 반영 (별도 삽입 로직 없음)
// ──────────────────────────────────────────────────────────────
import { CONFIG } from "../config.js";
import { toMin } from "./classify.js";
import { travelMinutes } from "./travel.js";
import { computePlan } from "./plan.js";

/**
 * @param {"shuttle"|"companion"} mode
 * @param {Array} baseJobs   오늘 배차 확정 잡
 * @param {Array} candidates 유예 별장 후보 잡 (est/deadline 포함)
 * @param {{lat:number,lng:number}} depot
 * @param {number} crewSize
 * @param {object} basePlan  기존 computePlan 결과
 * @returns {Promise<Array<{job, detour, solo, saving, plan}>>}
 */
export async function recommendBundles(mode, baseJobs, candidates, depot, crewSize, basePlan) {
  if (!basePlan || !candidates.length) return [];
  const workEnd = toMin(CONFIG.schedule.workEnd);
  const baseViolated = new Set(basePlan.violations.map((v) => v.villaId));
  const results = [];

  for (const cand of candidates) {
    const plan2 = await computePlan(mode, [...baseJobs, cand], depot, crewSize);
    const detour = plan2.totalTravel - basePlan.totalTravel;
    const oneWay = await travelMinutes(depot, cand.villa);
    const solo = oneWay * 2;

    // 기존 별장에 "새로" 생긴 데드라인 위반이 있는지
    const newViolation = plan2.violations.some(
      (v) => v.villaId !== cand.villaId && !baseViolated.has(v.villaId)
    );
    const fitsDay = plan2.endTime <= workEnd;
    const candOk = !plan2.violations.some((v) => v.villaId === cand.villaId);

    if (detour < solo * CONFIG.bundle.threshold && fitsDay && !newViolation && candOk) {
      results.push({ job: cand, detour, solo, saving: solo - detour, plan: plan2 });
    }
  }

  results.sort((a, b) => b.saving - a.saving);
  return results.slice(0, CONFIG.bundle.maxRecommendations);
}
