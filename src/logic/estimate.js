// ── 이 모듈의 가정 ─────────────────────────────────────────────
// - 청소시간 = (기본 + 평수 비례 + 부대시설 가산) × 오염도 배수
// - 평수 미상(null)이면 CONFIG.clean.defaultPyeong 적용
// - 결과는 5분 단위 올림 (현장 커뮤니케이션 단위)
// - 별장당 청소부 1명 기준 (v0 고정) — 인원 추가 투입에 따른 단축 미반영
// ──────────────────────────────────────────────────────────────
import { CONFIG } from "../config.js";

/**
 * @param {{size_pyeong: number|null, features?: string[]}} villa
 * @param {"normal"|"heavy"|"severe"} dirt
 * @returns {number} 분 (5분 단위 올림)
 */
export function estimateCleanMinutes(villa, dirt = "normal") {
  const c = CONFIG.clean;
  const pyeong = villa.size_pyeong ?? c.defaultPyeong;
  const bonus = (villa.features ?? []).reduce(
    (sum, f) => sum + (c.featureBonus[f] ?? 0),
    0
  );
  const mult = c.dirtMultiplier[dirt] ?? c.dirtMultiplier.normal;
  const raw = (c.baseMinutes + c.perPyeong * pyeong + bonus) * mult;
  return Math.ceil(raw / 5) * 5;
}
