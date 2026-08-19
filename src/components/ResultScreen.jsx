import { URGENT, RECOMMENDED, fmtTime } from "../logic/classify.js";
import { LABELS } from "../config.js";

const LEVEL_CLASS = { URGENT: "lv-urgent", RECOMMENDED: "lv-warn", DEFERRABLE: "lv-calm" };

// 셔틀 휴리스틱은 단조롭지 않다 — 별장을 추가하면 초기 드롭 배치가 바뀌어
// 총 이동시간이 오히려 줄어들 수 있다. 그 경우 부호를 그대로 보여준다.
const signed = (n) => `${n > 0 ? "+" : ""}${n}분`;

function JobCard({ job, badge }) {
  return (
    <div className={`job-card ${LEVEL_CLASS[job.level] ?? "lv-calm"}`}>
      <div className="job-head">
        <strong>{job.villa.name}</strong>
        <span className="villa-meta">
          {job.villa.region} · 청소 {job.est}분
          {job.dirt !== "normal" ? ` · 오염 ${LABELS.dirt[job.dirt]}` : ""}
        </span>
        {badge}
      </div>
      <p className="job-reason">{job.reason}</p>
    </div>
  );
}

function SectionTitle({ dot, children, count }) {
  return (
    <h2 className="section-title">
      <span className={`dot ${dot}`} />
      {children}
      <span className="count">{count}</span>
    </h2>
  );
}

export default function ResultScreen({
  plan, candidates, acceptedIds, bundles, computing,
  onAccept, onDismiss, onBack, onShowRoute,
}) {
  const urgent = plan.jobs.filter((j) => j.level === URGENT);
  const recommended = plan.jobs.filter((j) => j.level === RECOMMENDED);
  const acceptedJobs = plan.jobs.filter((j) => acceptedIds.includes(j.villaId));
  const deferrable = candidates.filter((c) => !acceptedIds.includes(c.villaId));

  return (
    <div className="screen">
      <header className="topbar">
        <div className="topbar-row">
          <button className="icon-btn back-btn" onClick={onBack} aria-label="뒤로">←</button>
          <div className="topbar-title">
            <span className="eyebrow">Triage</span>
            <h1>판단 결과</h1>
          </div>
          <span className="topbar-spacer" />
        </div>
      </header>

      <main className="list">
        {plan.violations.length > 0 && (
          <div className="banner">
            데드라인 불가:{" "}
            {plan.violations
              .map((v) => {
                const j = plan.jobs.find((jj) => jj.villaId === v.villaId);
                return `${j?.villa.name ?? v.villaId} (완료 ${fmtTime(v.finish)} > 마감 ${fmtTime(v.deadline)})`;
              })
              .join(", ")}
            <br />인력 추가 또는 일부 별장 유예를 검토하세요.
          </div>
        )}

        <section>
          <SectionTitle dot="dot-urgent" count={urgent.length}>긴급</SectionTitle>
          {urgent.length === 0 && <p className="empty">없음</p>}
          {urgent.map((j) => <JobCard key={j.villaId} job={j} />)}
        </section>

        <section>
          <SectionTitle dot="dot-warn" count={recommended.length}>권장</SectionTitle>
          {recommended.length === 0 && <p className="empty">없음</p>}
          {recommended.map((j) => <JobCard key={j.villaId} job={j} />)}
        </section>

        <section>
          <SectionTitle dot="dot-calm" count={deferrable.length + acceptedJobs.length}>
            유예 가능
          </SectionTitle>
          {deferrable.length + acceptedJobs.length === 0 && <p className="empty">없음</p>}
          {acceptedJobs.map((j) => (
            <JobCard key={j.villaId} job={j} badge={<span className="tag tag-green">경로 포함됨</span>} />
          ))}
          {deferrable.map((j) => <JobCard key={j.villaId} job={j} />)}
        </section>

        {bundles.length > 0 && (
          <section>
            <h2 className="section-title">
              <span className="dot" style={{ background: "var(--bronze)" }} />
              묶어가기 추천
              <span className="count">{bundles.length}</span>
            </h2>
            {bundles.map((rec) => (
              <div key={rec.job.villaId} className="bundle-card">
                <div className="bundle-head">
                  <strong>{rec.job.villa.name}</strong>
                  <span className="villa-meta">
                    {rec.job.villa.region} · {rec.job.reason.split("—")[1]?.trim() ?? rec.job.reason}
                  </span>
                </div>
                <ul className="bundle-numbers">
                  <li>
                    <span>
                      오늘 경로에 끼우면 이동
                      {rec.detour <= 0 && <em className="note"> 오히려 단축</em>}
                    </span>
                    <b>{signed(rec.detour)}</b>
                  </li>
                  <li><span>따로 가면 왕복</span><b>{rec.solo}분</b></li>
                  <li className="saving-row"><span>절약</span><b>{rec.saving}분</b></li>
                </ul>
                <div className="bundle-actions">
                  <button className="mini-btn accent" disabled={computing} onClick={() => onAccept(rec)}>
                    경로에 추가
                  </button>
                  <button className="mini-btn" disabled={computing} onClick={() => onDismiss(rec)}>
                    무시
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}
        <div className="list-bottom-space" />
      </main>

      <footer className="bottom-bar">
        <button className="primary-btn" onClick={onShowRoute} disabled={computing}>
          {computing ? "재계산 중…" : "동선 보기"}
        </button>
      </footer>
    </div>
  );
}
