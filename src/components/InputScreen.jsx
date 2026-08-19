import { useMemo } from "react";
import { LABELS, CONFIG } from "../config.js";
import { estimateCleanMinutes } from "../logic/estimate.js";

const CHECKIN_OPTIONS = ["today", "tomorrow", "d23", "none"];
const DIRT_OPTIONS = ["normal", "heavy", "severe"];

function Segment({ options, labels, value, onChange }) {
  return (
    <div className="segment" onClick={(e) => e.stopPropagation()}>
      {options.map((opt) => (
        <button
          key={opt}
          className={value === opt ? "seg-btn active" : "seg-btn"}
          onClick={() => onChange(opt)}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

export default function InputScreen({
  villas, vacantSeed, sel, setSel,
  mode, setMode, depots, depotId, setDepotId,
  crewSize, setCrewSize, jobCount, computing,
  onCalculate, onOpenSettings,
}) {
  const regions = useMemo(() => {
    const map = new Map();
    for (const v of villas) {
      if (!map.has(v.region)) map.set(v.region, []);
      map.get(v.region).push(v);
    }
    return [...map.entries()];
  }, [villas]);

  function toggleVilla(id) {
    setSel((s) => {
      const next = { ...s };
      if (next[id]) delete next[id];
      else next[id] = { checkin: "today", dirt: "normal" };
      return next;
    });
  }
  function updateSel(id, patch) {
    setSel((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  }

  return (
    <div className="screen">
      <header className="topbar">
        <div className="topbar-row">
          <div className="topbar-title">
            <span className="eyebrow">Daily Dispatch</span>
            <h1>오늘의 배차</h1>
          </div>
          <button className="icon-btn text-btn" onClick={onOpenSettings} aria-label="거점 설정">거점</button>
        </div>
        <div className="topbar-row controls">
          <div className="segment mode-toggle">
            <button
              className={mode === "shuttle" ? "seg-btn active" : "seg-btn"}
              onClick={() => setMode("shuttle")}
            >셔틀형</button>
            <button
              className={mode === "companion" ? "seg-btn active" : "seg-btn"}
              onClick={() => setMode("companion")}
            >동행형</button>
          </div>
          <select
            className="depot-select"
            value={depotId}
            onChange={(e) => setDepotId(e.target.value)}
          >
            {depots.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {mode === "shuttle" && (
            <label className="crew-input">
              청소부
              <input
                type="number" min="1" max="8" value={crewSize}
                onChange={(e) => setCrewSize(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
              />
              명
            </label>
          )}
        </div>
      </header>

      <main className="list">
        <p className="hint">
          오늘 체크아웃한 별장을 탭해서 선택하세요. 공실 별장은 자동 반영됩니다.
        </p>
        {regions.map(([region, list]) => {
          const activeCount = list.filter((v) => sel[v.id] || vacantSeed[v.id] != null).length;
          return (
            <details key={region} className="region" open={activeCount > 0}>
              <summary>
                <span className="region-name">{region}</span>
                <span className="region-meta">
                  {list.length}채{activeCount > 0 ? ` · 관련 ${activeCount}` : ""}
                </span>
              </summary>
              {list.map((v) => {
                const s = sel[v.id];
                const vacantDays = vacantSeed[v.id];
                const promoted = vacantDays != null && vacantDays >= CONFIG.schedule.maxDeferDays;
                return (
                  <div
                    key={v.id}
                    className={`villa-card${s ? " selected" : ""}`}
                    onClick={() => toggleVilla(v.id)}
                  >
                    <div className="villa-head">
                      <div>
                        <strong>{v.name}</strong>
                        <span className="villa-meta">
                          {v.area} · {v.size_pyeong ? `${v.size_pyeong}평` : "평수 미상"}
                          {v.features.map((f) => ` · ${LABELS.features[f]}`).join("")}
                        </span>
                      </div>
                      <div className="villa-tags">
                        {vacantDays != null && !s && (
                          <span className={`tag ${promoted ? "tag-red" : "tag-amber"}`}>
                            공실 {vacantDays}일째{promoted ? " · 승격" : ""}
                          </span>
                        )}
                        {s && <span className="tag tag-gold">오늘 체크아웃</span>}
                      </div>
                    </div>
                    {s && (
                      <div className="villa-expand" onClick={(e) => e.stopPropagation()}>
                        <div className="field">
                          <label>다음 체크인</label>
                          <Segment
                            options={CHECKIN_OPTIONS}
                            labels={LABELS.checkin}
                            value={s.checkin}
                            onChange={(v2) => updateSel(v.id, { checkin: v2 })}
                          />
                        </div>
                        <div className="field">
                          <label>오염도</label>
                          <Segment
                            options={DIRT_OPTIONS}
                            labels={LABELS.dirt}
                            value={s.dirt}
                            onChange={(v2) => updateSel(v.id, { dirt: v2 })}
                          />
                        </div>
                        <div className="est-line">
                          예상 청소시간 {estimateCleanMinutes(v, s.dirt)}분
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </details>
          );
        })}
        <div className="list-bottom-space" />
      </main>

      <footer className="bottom-bar">
        <button
          className="primary-btn"
          disabled={jobCount === 0 || computing}
          onClick={onCalculate}
        >
          {computing ? "계산 중…" : `배차 계산 (${jobCount}건)`}
        </button>
      </footer>
    </div>
  );
}
