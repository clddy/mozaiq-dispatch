import { useMemo, useState } from "react";
import villasData from "./data/villas.json";
import depotsData from "./data/depots.json";
import { classify, URGENT, RECOMMENDED, DEFERRABLE } from "./logic/classify.js";
import { estimateCleanMinutes } from "./logic/estimate.js";
import { computePlan } from "./logic/plan.js";
import { recommendBundles } from "./logic/bundle.js";
import InputScreen from "./components/InputScreen.jsx";
import ResultScreen from "./components/ResultScreen.jsx";
import RouteScreen from "./components/RouteScreen.jsx";
import SettingsSheet from "./components/SettingsSheet.jsx";
import { CONFIG } from "./config.js";

// 데모 시드: 이미 공실 상태인 별장 (체크아웃 후 경과일).
// 실데이터 연동 시 예약 시스템에서 계산해 내려줄 값.
const VACANT_SEED = { sawasawa: 1, yunseul: 2, ikki: 3 };

const villaById = Object.fromEntries(villasData.map((v) => [v.id, v]));

function makeJob(villa, checkin, dirt, vacantDays) {
  const cls = classify({ checkin, vacantDays });
  return {
    villaId: villa.id,
    villa,
    checkin,
    dirt,
    vacantDays,
    est: estimateCleanMinutes(villa, dirt),
    level: cls.level,
    reason: cls.reason,
    deadline: cls.deadline,
  };
}

export default function App() {
  const [screen, setScreen] = useState(1);
  const [mode, setMode] = useState("shuttle");
  const [depots, setDepots] = useState(depotsData);
  const [depotId, setDepotId] = useState(depotsData[0].id);
  const [crewSize, setCrewSize] = useState(CONFIG.shuttle.crewSize);
  const [sel, setSel] = useState({}); // villaId -> { checkin, dirt }
  const [computing, setComputing] = useState(false);
  const [plan, setPlan] = useState(null);
  const [bundles, setBundles] = useState([]);
  const [acceptedIds, setAcceptedIds] = useState([]);
  const [showSettings, setShowSettings] = useState(false);

  const depot = depots.find((d) => d.id === depotId) ?? depots[0];

  // 오늘 체크아웃으로 선택된 잡
  const selectedJobs = useMemo(
    () =>
      Object.entries(sel).map(([id, s]) =>
        makeJob(villaById[id], s.checkin, s.dirt, 0)
      ),
    [sel]
  );

  // 공실 시드 잡 (선택된 별장과 중복 제외)
  const vacantJobs = useMemo(
    () =>
      Object.entries(VACANT_SEED)
        .filter(([id]) => !sel[id])
        .map(([id, days]) => makeJob(villaById[id], "none", "normal", days)),
    [sel]
  );

  // 오늘 무조건 포함: 선택 잡 + 승격된(URGENT) 공실 잡
  const todayJobs = useMemo(
    () => [...selectedJobs, ...vacantJobs.filter((j) => j.level !== DEFERRABLE)],
    [selectedJobs, vacantJobs]
  );
  // 묶어가기 후보: 유예 가능한 공실 잡
  const candidates = useMemo(
    () => vacantJobs.filter((j) => j.level === DEFERRABLE),
    [vacantJobs]
  );

  async function calculate() {
    if (!todayJobs.length || computing) return;
    setComputing(true);
    try {
      const p = await computePlan(mode, todayJobs, depot, crewSize);
      const b = await recommendBundles(mode, todayJobs, candidates, depot, crewSize, p);
      setPlan(p);
      setBundles(b);
      setAcceptedIds([]);
      setScreen(2);
    } finally {
      setComputing(false);
    }
  }

  async function acceptBundle(rec) {
    // 추천 계산 시 이미 만들어 둔 재계산 결과를 그대로 채택
    setPlan(rec.plan);
    const newAccepted = [...acceptedIds, rec.job.villaId];
    setAcceptedIds(newAccepted);
    // 남은 후보는 새 베이스 기준으로 다시 검사
    const remaining = candidates.filter(
      (c) => c.villaId !== rec.job.villaId && !newAccepted.includes(c.villaId)
    );
    setComputing(true);
    try {
      const b = await recommendBundles(mode, rec.plan.jobs, remaining, depot, crewSize, rec.plan);
      setBundles(b);
    } finally {
      setComputing(false);
    }
  }

  function dismissBundle(rec) {
    setBundles((bs) => bs.filter((b) => b.job.villaId !== rec.job.villaId));
  }

  return (
    <div className="app">
      {screen === 1 && (
        <InputScreen
          villas={villasData}
          vacantSeed={VACANT_SEED}
          sel={sel}
          setSel={setSel}
          mode={mode}
          setMode={setMode}
          depots={depots}
          depotId={depotId}
          setDepotId={setDepotId}
          crewSize={crewSize}
          setCrewSize={setCrewSize}
          jobCount={todayJobs.length}
          computing={computing}
          onCalculate={calculate}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}
      {screen === 2 && plan && (
        <ResultScreen
          plan={plan}
          candidates={candidates}
          acceptedIds={acceptedIds}
          bundles={bundles}
          computing={computing}
          onAccept={acceptBundle}
          onDismiss={dismissBundle}
          onBack={() => setScreen(1)}
          onShowRoute={() => setScreen(3)}
        />
      )}
      {screen === 3 && plan && (
        <RouteScreen
          plan={plan}
          villaById={villaById}
          depot={depot}
          crewSize={crewSize}
          onBack={() => setScreen(2)}
        />
      )}
      {showSettings && (
        <SettingsSheet
          depots={depots}
          setDepots={setDepots}
          depotId={depotId}
          setDepotId={setDepotId}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
