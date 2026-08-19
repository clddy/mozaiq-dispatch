import { useState } from "react";

export default function SettingsSheet({ depots, setDepots, depotId, setDepotId, onClose }) {
  const [draft, setDraft] = useState({ name: "", lat: "", lng: "" });

  function update(id, field, value) {
    setDepots((ds) => ds.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  }
  function remove(id) {
    if (depots.length <= 1) return;
    setDepots((ds) => ds.filter((d) => d.id !== id));
    if (depotId === id) setDepotId(depots.find((d) => d.id !== id).id);
  }
  function add() {
    const lat = Number(draft.lat);
    const lng = Number(draft.lng);
    if (!draft.name.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const id = `custom-${Date.now()}`;
    setDepots((ds) => [...ds, { id, name: draft.name.trim(), lat, lng }]);
    setDraft({ name: "", lat: "", lng: "" });
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>거점 관리</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="sheet-body">
          {depots.map((d) => (
            <div key={d.id} className="depot-row">
              <button
                className={`star-btn${depotId === d.id ? " on" : ""}`}
                title="기본 거점으로"
                onClick={() => setDepotId(d.id)}
              >★</button>
              <input
                className="depot-name"
                value={d.name}
                onChange={(e) => update(d.id, "name", e.target.value)}
              />
              <input
                className="depot-coord" type="number" step="0.0001" value={d.lat}
                onChange={(e) => update(d.id, "lat", Number(e.target.value))}
              />
              <input
                className="depot-coord" type="number" step="0.0001" value={d.lng}
                onChange={(e) => update(d.id, "lng", Number(e.target.value))}
              />
              <button className="icon-btn" onClick={() => remove(d.id)} disabled={depots.length <= 1}>🗑</button>
            </div>
          ))}
          <div className="depot-row add-row">
            <span className="star-btn" />
            <input
              className="depot-name" placeholder="새 거점 이름" value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <input
              className="depot-coord" placeholder="위도" type="number" value={draft.lat}
              onChange={(e) => setDraft({ ...draft, lat: e.target.value })}
            />
            <input
              className="depot-coord" placeholder="경도" type="number" value={draft.lng}
              onChange={(e) => setDraft({ ...draft, lng: e.target.value })}
            />
            <button className="icon-btn" onClick={add}>＋</button>
          </div>
          <p className="hint">★를 눌러 기본 거점을 선택하세요. 새로고침 시 초기화됩니다 (v0).</p>
        </div>
      </div>
    </div>
  );
}
