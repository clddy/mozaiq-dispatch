import { useEffect, useRef } from "react";
import L from "leaflet";

const MIN_MARKER_GAP_PX = 26; // 이보다 가까운 마커는 표시 위치를 밀어낸다

// 기사/팀이 실제로 지나는 순서대로 좌표 시퀀스를 만든다.
// 셔틀형은 타임라인(드롭·픽업 재방문 포함), 동행형은 방문 순서.
function buildPath(plan, villaById, depot) {
  const pts = [[depot.lat, depot.lng]];
  if (plan.mode === "shuttle") {
    for (const e of plan.timeline) {
      if (e.villaId && (e.action === "drop" || e.action === "pickup")) {
        const v = villaById[e.villaId];
        pts.push([v.lat, v.lng]);
      }
    }
  } else {
    for (const s of plan.schedule) {
      const v = villaById[s.villaId];
      pts.push([v.lat, v.lng]);
    }
  }
  pts.push([depot.lat, depot.lng]);
  return pts;
}

// 첫 방문 순서 기준 별장 번호
function visitOrder(plan) {
  const order = [];
  const seen = new Set();
  const seq =
    plan.mode === "shuttle"
      ? plan.timeline.filter((e) => e.villaId).map((e) => e.villaId)
      : plan.schedule.map((s) => s.villaId);
  for (const id of seq) {
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  return order;
}

/**
 * 좌표가 지역 단위 근사라 같은 권역 별장들이 한 점에 뭉친다.
 * 겹치는 마커의 "표시 위치"만 픽셀 기준으로 밀어낸다 — 계산 좌표는 그대로다.
 */
function fanOutPositions(map, latlngs, anchor) {
  const pts = latlngs.map((ll) => map.latLngToLayerPoint(ll));
  const fixed = [map.latLngToLayerPoint(anchor)]; // 거점은 움직이지 않는 기준점
  for (let i = 0; i < pts.length; i++) {
    for (const other of [...fixed, ...pts.slice(0, i)]) {
      const dx = pts[i].x - other.x;
      const dy = pts[i].y - other.y;
      const d = Math.hypot(dx, dy);
      if (d < MIN_MARKER_GAP_PX) {
        // 완전히 겹치면 인덱스로 방향을 갈라 결정적으로 배치한다
        const a = d === 0 ? (i * 2 * Math.PI) / Math.max(1, pts.length) : Math.atan2(dy, dx);
        pts[i] = L.point(
          other.x + Math.cos(a) * MIN_MARKER_GAP_PX,
          other.y + Math.sin(a) * MIN_MARKER_GAP_PX
        );
      }
    }
  }
  return pts.map((p) => map.layerPointToLatLng(p));
}

export default function MapView({ plan, villaById, depot }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map(boxRef.current, { zoomControl: false, attributionControl: true });
      // 어두운 UI에 맞춘 다크 타일 (CARTO, API 키 불필요)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap &copy; CARTO",
      }).addTo(mapRef.current);
    }
    const map = mapRef.current;
    if (layerRef.current) layerRef.current.remove();
    const group = L.featureGroup();

    // 경로 폴리라인 — 이 선이 거점과 모든 별장을 포함하므로 화면 맞춤의 기준이 된다
    const path = buildPath(plan, villaById, depot);
    const line = L.polyline(path, {
      color: "#c2a24e",
      weight: 2,
      opacity: 0.85,
      dashArray: "5 5",
    }).addTo(group);

    group.addTo(map);
    layerRef.current = group;
    map.fitBounds(line.getBounds().pad(0.3));

    // 줌이 정해진 뒤에야 픽셀 간격을 계산할 수 있다
    const order = visitOrder(plan);
    const trueLatLngs = order.map((id) => L.latLng(villaById[id].lat, villaById[id].lng));
    const shown = fanOutPositions(map, trueLatLngs, L.latLng(depot.lat, depot.lng));

    order.forEach((villaId, i) => {
      const v = villaById[villaId];
      // 밀어낸 마커는 실제 위치와 가는 선으로 이어 둔다
      if (map.latLngToLayerPoint(shown[i]).distanceTo(map.latLngToLayerPoint(trueLatLngs[i])) > 2) {
        L.polyline([trueLatLngs[i], shown[i]], {
          color: "#c2a24e",
          weight: 1,
          opacity: 0.35,
        }).addTo(group);
      }
      L.marker(shown[i], {
        icon: L.divIcon({
          className: "",
          html: `<div class="marker villa-marker">${i + 1}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      })
        .bindPopup(`${i + 1}. ${v.name} · ${v.region}`)
        .addTo(group);
    });

    // 거점은 항상 위에
    L.marker([depot.lat, depot.lng], {
      icon: L.divIcon({
        className: "",
        html: '<div class="marker depot-marker">◆</div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
      zIndexOffset: 1000,
    })
      .bindPopup(depot.name)
      .addTo(group);
  }, [plan, villaById, depot]);

  useEffect(() => () => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
  }, []);

  return <div ref={boxRef} className="map-box" />;
}
