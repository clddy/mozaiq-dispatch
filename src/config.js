// 모든 튜닝 파라미터는 이 파일에서만 조정한다. 매직 넘버 금지.
export const CONFIG = {
  clean: {
    baseMinutes: 90,
    perPyeong: 0.6,
    defaultPyeong: 80,
    // 부대시설별 추가 청소시간(분). MOZAIQ 공개 별장 소개의 시설 표기를 기준으로 잡았다.
    featureBonus: {
      pool: 30, // 독채 풀빌라 / 야외 수영장
      sauna: 20, // 사우나 / 스파 / 히노끼
      jacuzzi: 12, // 자쿠지 / 족욕실
      hanok: 20, // 한옥 구조
      cinema: 10, // 시네마룸
      karaoke: 10, // 노래방
      bbq: 15, // 야외 다이닝 / 바베큐 / 파이어존
      garden: 10, // 야외 정원 / 정자
      tea: 8, // 다도실
    },
    dirtMultiplier: { normal: 1.0, heavy: 1.3, severe: 1.6 },
  },
  schedule: {
    workStart: "08:00",
    workEnd: "18:00",
    checkoutTime: "11:00",
    checkinTime: "15:00",
    inspectionBufferMin: 45, // 체크인 전 검수 버퍼
    maxDeferDays: 3, // 빈 별장 최대 방치 일수
  },
  shuttle: {
    cleanersPerVilla: 1, // v0 고정
    vehicleCapacity: 4, // 동시 탑승 청소부 수
    crewSize: 3, // 오늘 가용 청소부 수 (입력에서 변경 가능)
  },
  bundle: {
    threshold: 0.5, // detour < solo × threshold 일 때 추천
    maxRecommendations: 2,
  },
  travel: {
    roadFactor: 1.4, // 직선거리 보정계수
    avgSpeedKmh: 60,
  },
};

// 한글 라벨 (UI 공용)
export const LABELS = {
  features: {
    pool: "풀빌라",
    sauna: "사우나",
    jacuzzi: "자쿠지",
    hanok: "한옥",
    cinema: "시네마룸",
    karaoke: "노래방",
    bbq: "바베큐",
    garden: "정원",
    tea: "다도",
  },
  dirt: { normal: "보통", heavy: "심함", severe: "매우 심함" },
  checkin: { today: "오늘", tomorrow: "내일", d23: "2~3일 후", none: "없음" },
};
