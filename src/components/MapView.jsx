import { useEffect, useRef } from "react";
import L from "leaflet";

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

export default function MapView({ plan, villaById, depot }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map(boxRef.current, { zoomControl: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap",
      }).addTo(mapRef.current);
    }
    const map = mapRef.current;
    if (layerRef.current) layerRef.current.remove();
    const group = L.featureGroup();

    // 경로 폴리라인
    const path = buildPath(plan, villaById, depot);
    L.polyline(path, { color: "#2563eb", weight: 3, opacity: 0.75, dashArray: "6 6" }).addTo(group);

    // 거점 마커
    L.marker([depot.lat, depot.lng], {
      icon: L.divIcon({
        className: "",
        html: '<div class="marker depot-marker">🏠</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    })
      .bindPopup(depot.name)
      .addTo(group);

    // 별장 마커 (방문 순서 번호)
    visitOrder(plan).forEach((villaId, i) => {
      const v = villaById[villaId];
      L.marker([v.lat, v.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="marker villa-marker">${i + 1}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      })
        .bindPopup(`${i + 1}. ${v.name} (${v.region})`)
        .addTo(group);
    });

    group.addTo(map);
    layerRef.current = group;
    map.fitBounds(group.getBounds().pad(0.25));
  }, [plan, villaById, depot]);

  useEffect(() => () => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
  }, []);

  return <div ref={boxRef} className="map-box" />;
}
