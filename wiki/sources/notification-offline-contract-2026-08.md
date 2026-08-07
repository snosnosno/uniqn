---
area: sources
updated: 2026-08-08
status: current
sources:
  - uniqn-mobile/src/constants/notificationTemplates.ts
  - uniqn-mobile/src/services/notifications/internal/__tests__/dbNotificationTypeDrift.test.ts
  - uniqn-mobile/src/domains/schedule/ScheduleMerger.ts
  - uniqn-mobile/src/lib/mmkvStorage.ts
  - PR#396
  - PR#397
  - PR#398
  - PR#404
  - PR#429
tags: [notification, offline, cache, reminder, deeplink]
---

# 소스: 알림 계약 · 오프라인 캐시 웨이브 (PR#396·#397·#398·#404·#429)

## 침묵 취소 — 관측 창 없이 "없으면 취소"하지 마라 (PR#396·#404)

근무 리마인더가 **다른 달 예약을 침묵 취소**하고 있었다. 현재 조회 범위에 없는 예약을
"사라진 것"으로 보고 취소했기 때문이다. 오프라인 빈 폴백도 같은 형태였다 —
네트워크가 없어 빈 배열이 온 것을 "예약 없음"으로 읽었다.

> 🔑 동기화 로직이 "목록에 없으면 지운다"를 할 때는 **관측 창(observation window)** 을 먼저 정의한다.
> 창 밖의 것은 "없는 것"이 아니라 **"모르는 것"** 이다.
> 이는 [[error-vs-empty-state]] 의 쓰기 버전이다 — 실패를 빈 값으로 읽으면 읽기에서는 오안내,
> 쓰기에서는 **데이터 삭제**가 된다.

## 오프라인 캐시 TTL 은 온라인 staleTime 과 분리한다 (PR#398)

둘을 같은 값으로 쓰면 "온라인에서 신선한 기준"이 오프라인 보존 기간을 결정해 버린다.
분리하고 **타입으로 재발을 차단**했다(`mmkvStorage.ts`).

## 알림 타입 드리프트 — 값의 출생을 먼저 물어라 (PR#429)

감사가 "미등록 알림 타입"을 발견했을 때, 그건 **증상이지 원인이 아니었다.**
원인은 리팩터 회귀 — 출퇴근 알림 타입이 수신자 구분을 잃어버린 것이었다.

> 🔑 "등록되지 않은 값"을 만나면 등록표에 추가하기 전에 **그 값이 어디서 태어났는지** 추적하라.
> 등록표를 늘리는 수정은 회귀를 정상으로 만들어 버린다.

방어로 **DB 발송 타입 드리프트 가드**를 세웠다(`dbNotificationTypeDrift.test.ts`) —
DB 트리거가 보내는 타입 집합과 클라 템플릿 집합이 갈라지면 테스트가 red 가 된다.
prod 기록명 `20260807052312`·`20260807052352`.

⚠️ **롤아웃 비대칭 주의**: Edge Function 은 master push 시 자동 배포되지만 클라 렌더링은
OTA 이후다. 알림 계약을 바꾸면 그 사이 구 클라가 새 타입을 받는 구간이 생긴다.

## 알림 계약 정합 (PR#397)

지급 완료 되돌리기 알림 신설 + 취소 힌트 조건 정합. prod 기록명 `20260801174901`·`20260801180734`.

## 연결

- 읽기 축의 같은 착오: [[error-vs-empty-state]]
- 지속 캐시가 OTA 를 건너 살아남는 문제: [[persisted-cache-shape-drift]]
- Edge Function 배포 비대칭: [[layers]]
- 정산 상태 변화가 알림을 낳는 지점: [[settlement-rpc-wave-2026-08]]
