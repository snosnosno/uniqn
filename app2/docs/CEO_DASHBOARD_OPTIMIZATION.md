# CEO 대시보드 성능 최적화 문서

## 개요
CEO 대시보드의 실시간 구독을 9개에서 5개로 최적화하여 성능을 개선했습니다.

## 최적화 전후 비교

### 최적화 전 (9개 구독)
1. events - 토너먼트 현황
2. participants - 참가자 수
3. workLogs - 근무 기록
4. attendanceRecords - 출석 기록 (workLogs와 별도)
5. payrollCalculations - 급여 계산
6. staff - 스태프 정보
7. jobPostings - 구인공고
8. users - 승인 대기 사용자
9. ratings - 딜러 평점
10. tables - 테이블 현황

### 최적화 후 (5개 구독 + 폴링)
1. **events (통합)** - 토너먼트 + participantCount 필드 활용
2. **attendanceRecords (통합)** - 출석 + 근무 정보 통합
3. **payrollCalculations** - 급여 현황
4. **staff (통합)** - 스태프 + 승인 대기 사용자 통합 조회  
5. **jobPostings (통합)** - 구인공고 + applicantCount 필드 활용

### 폴링으로 전환 (30초 주기)
- **ratings** - 딜러 평점 (실시간 필요성 낮음)
- **tables** - 테이블 현황 (실시간 필요성 낮음)

## 구현 세부사항

### 1. 통합 쿼리 구현
```typescript
// 이벤트 + 참가자 수 통합
const eventsQuery = query(
  collection(db, 'events'),
  where('status', '==', 'active')
);

// 각 이벤트 문서의 participantCount 필드 활용
dashboardData.totalParticipants = snapshot.docs.reduce(
  (total, doc) => total + (doc.data().participantCount || 0), 0
);
```

### 2. Firebase Functions 트리거 추가
```typescript
// 참가자 추가/삭제 시 자동으로 participantCount 업데이트
export const updateEventParticipantCount = functions.firestore
  .document('participants/{participantId}')
  .onWrite(async (change, context) => {
    // 이벤트의 participantCount 자동 업데이트
  });

// 지원자 추가/삭제 시 자동으로 applicantCount 업데이트  
export const updateJobPostingApplicantCount = functions.firestore
  .document('applications/{applicationId}')
  .onWrite(async (change, context) => {
    // 구인공고의 applicantCount 자동 업데이트
  });
```

### 3. 캐싱 전략 강화
- 대시보드 전체 데이터 캐시: 10초 → 30초
- 폴링 데이터 캐시: 30초 TTL
- 초기 로드 시 캐시된 데이터 즉시 표시

### 4. 폴링 시스템 구현
```typescript
// 30초마다 평점, 테이블 데이터 업데이트
pollingIntervalRef.current = setInterval(async () => {
  const updatedPollingData = await fetchPollingData();
  setData(prevData => ({
    ...prevData,
    topDealers: updatedPollingData.topDealers,
    activeTables: updatedPollingData.activeTables,
    totalTables: updatedPollingData.totalTables,
    tableUtilization: updatedPollingData.tableUtilization
  }));
}, 30000);
```

## 성능 개선 효과

### 리소스 사용량
- **실시간 구독 수**: 9개 → 5개 (44% 감소)
- **Firebase 읽기 작업**: 약 40% 감소 예상
- **네트워크 트래픽**: 약 35% 감소 예상

### 사용자 경험
- **초기 로드 시간**: 개선 (캐시 활용)
- **실시간성**: 핵심 데이터는 여전히 실시간
- **데이터 정확성**: 자동 카운트 업데이트로 정확도 향상

## 주의사항

1. **Firebase Functions 배포 필요**
   - `updateEventParticipantCount` 함수
   - `updateJobPostingApplicantCount` 함수

2. **기존 데이터 마이그레이션**
   - 기존 이벤트에 `participantCount` 필드 추가 필요
   - 기존 구인공고에 `applicantCount` 필드 추가 필요

3. **모니터링**
   - 폴링 주기(30초)가 적절한지 모니터링 필요
   - 캐시 효율성 모니터링 권장

## 향후 개선 방안

1. **GraphQL 도입 검토**
   - 더 효율적인 데이터 페칭
   - 필요한 필드만 선택적 조회

2. **서버 사이드 집계**
   - Firebase Functions에서 대시보드 데이터 사전 집계
   - 단일 문서로 대시보드 데이터 제공

3. **WebSocket 활용**
   - 실시간 업데이트가 필요한 데이터만 WebSocket으로 전송
   - 나머지는 REST API 활용