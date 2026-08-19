import { fmtTime } from "../logic/classify.js";
import { CONFIG } from "../config.js";
import MapView from "./MapView.jsx";

const FATIGUE_THRESHOLD = 3; // 한 청소부 연속 배정 자동 체크 기준(건)
const SLACK_WARN_MIN = 30; // 일정 여유 경고 기준(분)

function cleanerName(id) {
  return id == null ? "" : String.fromCharCode(65 + id);
}

function ShuttleTimeline({ plan, villaById }) {
  const estByVilla = Object.fromEntries(plan.jobs.map((j) => [j.villaId, j.est]));
  return (
    <ol className="timeline">
      {plan.timeline.map((e, i) => {
        const villa = e.villaId ? villaById[e.villaId] : null;
        let cls = "tl-item";
        let text = null;
        if (e.action === "depart") text = "거점 출발";
        else if (e.action === "drop") {
          cls += " tl-drop";
          text = (
            <>
              {villa.name} 도착 — 청소부 <span className="tl-cleaner">{cleanerName(e.cleanerId)}</span> 드롭
              <br />
              <small>청소 {estByVilla[e.villaId]}분 소요</small>
            </>
          );
        } else if (e.action === "pickup") {
          cls += " tl-pickup";
          text = (
            <>
              {villa.name} — 청소부 <span className="tl-cleaner">{cleanerName(e.cleanerId)}</span> 픽업
            </>
          );
        } else if (e.action === "wait") {
          cls += " tl-wait";
          text = (
            <>
              기사 대기 {e.minutes}분
              <br />
              <small className="tl-range">
                {fmtTime(e.time)} ~ {fmtTime(e.time + e.minutes)}
              </small>
            </>
          );
        } else if (e.action === "return") text = "거점 복귀";
        return (
          <li key={i} className={cls}>
            <span className="tl-time">{fmtTime(e.time)}</span>
            <span className="tl-text">{text}</span>
          </li>
        );
      })}
    </ol>
  );
}

function CompanionTimeline({ plan, villaById }) {
  const first = plan.schedule[0];
  return (
    <ol className="timeline">
      <li className="tl-item">
        <span className="tl-time">{fmtTime(first.arrive - first.travelFromPrev)}</span>
        <span className="tl-text">거점 출발</span>
      </li>
      {plan.schedule.map((s, i) => (
        <li key={s.villaId} className="tl-item tl-drop">
          <span className="tl-time">{fmtTime(s.arrive)}</span>
          <span className="tl-text">
            {i + 1}. {villaById[s.villaId].name} 도착
            <br />
            <small>
              이동 {s.travelFromPrev}분 · 청소 {fmtTime(s.arrive)} ~ {fmtTime(s.finish)}
            </small>
          </span>
        </li>
      ))}
      <li className="tl-item">
        <span className="tl-time">{fmtTime(plan.endTime)}</span>
        <span className="tl-text">거점 복귀</span>
      </li>
    </ol>
  );
}

export default function RouteScreen({ plan, villaById, depot, crewSize, onBack }) {
  const isShuttle = plan.mode === "shuttle";

  // 자동 체크: 피로도 / 지연 전파 리스크
  const fatigue = isShuttle
    ? Object.values(plan.perCleaner ?? {}).some((c) => c >= FATIGUE_THRESHOLD)
    : plan.jobs.length >= FATIGUE_THRESHOLD;
  let minSlack = null;
  if (isShuttle) {
    minSlack = plan.minSlack;
  } else {
    const slacks = plan.schedule
      .map((s) => {
        const j = plan.jobs.find((jj) => jj.villaId === s.villaId);
        return j?.deadline != null ? j.deadline - s.finish : null;
      })
      .filter((v) => v != null);
    minSlack = slacks.length ? Math.min(...slacks) : null;
  }
  const delayRisk = minSlack != null && minSlack < SLACK_WARN_MIN;

  return (
    <div className="screen">
      <header className="topbar">
        <div className="topbar-row">
          <button className="icon-btn back-btn" onClick={onBack} aria-label="뒤로">←</button>
          <div className="topbar-title">
            <span className="eyebrow">Route</span>
            <h1>동선 · {isShuttle ? "셔틀형" : "동행형"}</h1>
          </div>
          <span className="topbar-spacer" />
        </div>
        <div className="summary-row">
          <div className="summary-item">
            <small>Travel</small>
            <b>{plan.totalTravel}분</b>
          </div>
          <div className="summary-item">
            <small>Clean</small>
            <b>{plan.totalClean}분</b>
          </div>
          <div className="summary-item">
            <small>Done by</small>
            <b>{fmtTime(plan.endTime)}</b>
          </div>
        </div>
      </header>

      <main className="list">
        {plan.violations.length > 0 && (
          <div className="banner">
            데드라인 불가:{" "}
            {plan.violations
              .map((v) => `${villaById[v.villaId]?.name ?? v.villaId} 완료 ${fmtTime(v.finish)} > 마감 ${fmtTime(v.deadline)}`)
              .join(", ")}
          </div>
        )}

        <MapView plan={plan} villaById={villaById} depot={depot} />

        {isShuttle
          ? <ShuttleTimeline plan={plan} villaById={villaById} />
          : <CompanionTimeline plan={plan} villaById={villaById} />}

        <details className="fold">
          <summary>이 계산에 포함되지 않은 요소</summary>
          <ul className="fold-list">
            <li className={fatigue ? "checked" : ""}>
              <span className="mark">{fatigue ? "■" : "□"}</span>
              <span>
                팀 피로도
                {fatigue && <small>한 청소부에 연속 {FATIGUE_THRESHOLD}건 이상 배정됨</small>}
              </span>
            </li>
            <li className={delayRisk ? "checked" : ""}>
              <span className="mark">{delayRisk ? "■" : "□"}</span>
              <span>
                지연 전파 리스크
                {delayRisk && <small>일정 여유 {minSlack}분 — 기준 {SLACK_WARN_MIN}분 미만</small>}
              </span>
            </li>
            <li><span className="mark">□</span><span>기상 · 도로 상황</span></li>
            <li><span className="mark">□</span><span>청소 외 특이 작업: 파손, 분실물 등</span></li>
          </ul>
        </details>

        <details className="fold">
          <summary>이 계산의 가정</summary>
          <ul className="fold-list">
            <li>
              <span className="mark">·</span>
              <span>별장당 청소부 {CONFIG.shuttle.cleanersPerVilla}명 투입{isShuttle ? ` (오늘 가용 ${crewSize}명)` : ""}</span>
            </li>
            <li>
              <span className="mark">·</span>
              <span>검수 절차 별도 미반영 — 버퍼 {CONFIG.schedule.inspectionBufferMin}분으로 근사</span>
            </li>
            <li>
              <span className="mark">·</span>
              <span>이동시간은 직선거리 × {CONFIG.travel.roadFactor} 근사 (카카오맵 API 교체 예정)</span>
            </li>
            <li>
              <span className="mark">·</span>
              <span>좌표는 지역 단위 근사 (실제 주소 비공개)</span>
            </li>
          </ul>
        </details>
        <div className="list-bottom-space" />
      </main>
    </div>
  );
}
