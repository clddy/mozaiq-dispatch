// ── 이 모듈의 가정 ─────────────────────────────────────────────
// - 긴급도는 "다음 체크인 시점"과 "공실 경과일" 두 축으로만 판단
// - 오늘 체크인: 체크인 시각 − 검수 버퍼가 당일 데드라인이 된다
// - 내일 체크인: 오늘 중 완료 필요 (당일 내 데드라인은 workEnd 가 자연 제약)
// - 공실 경과일 ≥ maxDeferDays 인 유예 별장은 URGENT 로 승격
// ──────────────────────────────────────────────────────────────
import { CONFIG } from "../config.js";

export const URGENT = "URGENT";
export const RECOMMENDED = "RECOMMENDED";
export const DEFERRABLE = "DEFERRABLE";

export function toMin(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fmtTime(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  const prefix = h >= 24 ? "익일 " : "";
  return `${prefix}${String(h % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * @param {{checkin: "today"|"tomorrow"|"d23"|"none", vacantDays?: number}} job
 * @returns {{level: string, reason: string, deadline: number|null}}
 *   deadline: 자정 기준 분, 당일 내 마감이 없으면 null
 */
export function classify(job) {
  const { checkinTime, inspectionBufferMin, maxDeferDays } = CONFIG.schedule;
  const vacantDays = job.vacantDays ?? 0;

  if (job.checkin === "today") {
    const deadline = toMin(checkinTime) - inspectionBufferMin;
    return {
      level: URGENT,
      reason: `오늘 ${checkinTime} 체크인 — 검수 버퍼 포함 ${fmtTime(deadline)}까지 완료 필요`,
      deadline,
    };
  }
  if (job.checkin === "tomorrow") {
    return {
      level: URGENT,
      reason: "내일 체크인 — 오늘 중 청소 필요",
      deadline: null,
    };
  }
  if (job.checkin === "d23") {
    return {
      level: RECOMMENDED,
      reason: "2~3일 후 체크인 — 오늘 처리 권장",
      deadline: null,
    };
  }
  // checkin === "none"
  if (vacantDays >= maxDeferDays) {
    return {
      level: URGENT,
      reason: `공실 ${vacantDays}일 경과 — 최대 방치 ${maxDeferDays}일 도달, 승격`,
      deadline: null,
    };
  }
  const left = maxDeferDays - vacantDays;
  return {
    level: DEFERRABLE,
    reason:
      vacantDays > 0
        ? `공실 ${vacantDays}일째 — 유예 ${left}일 남음`
        : `체크인 미정 — 유예 ${left}일 남음`,
    deadline: null,
  };
}
