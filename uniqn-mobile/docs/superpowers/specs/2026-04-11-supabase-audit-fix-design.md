# Supabase 이전 감사 수정 + Phase 4 Firebase 제거

## 목적

Firebase → Supabase 이전 Phase 0~3 완료 후 전면 감사에서 발견된 이슈를 수정하고, Firebase 코드를 완전히 제거한다. 프로덕션 경로는 이미 Supabase를 사용 중이므로, 이 작업은 타입 안전성 확보, 성능 최적화, dead code 정리에 해당한다.

## 완료 조건

- `npm run quality` 통과 (tsc + eslint + prettier)
- `npm test` 기존 테스트 유지 (추가 실패 0건)
- `grep -r "firebase" src/` 결과 0건 (logger.firebase 메서드명 제외)
- Firebase npm 패키지 제거 완료

---

## 아키텍처 변경

### A4. JobPostingStatus 타입 확장

**문제**: DB enum 8개 vs TS 타입 3개 불일치
**해결**: TS 타입을 DB enum에 맞춰 확장

변경 파일:

- `src/types/jobPosting.ts:29` — 3개 → 8개
- `src/schemas/jobPosting.schema.ts` — Zod enum 동기화
- `src/constants/statusConfig.ts`, `statusValues.ts` — 상수 추가

---

### B. Realtime 최적화

**문제**: 사용자당 11개 Realtime 구독 → Free Tier 100 연결 초과 위험
**해결**: WorkLog 4개 subscribe → polling 전환, 에러 핸들링 강화, 알림 캐시 증분 업데이트

**B1**: `src/utils/supabase.ts` createRealtimeSubscription — CHANNEL_ERROR/TIMED_OUT 처리 추가
**B2**: `src/repositories/supabase/WorkLogRepository.ts` — 4개 subscribe → TanStack Query refetchInterval(30s)
**B3**: `src/repositories/supabase/NotificationRepository.ts` — invalidateQueries(all) → setQueryData 증분

---

### C. 쿼리 최적화 + 타입 안전성

**C1**: 15개 Repository의 `.select('*')` → 명시적 컬럼 상수
**C2**: `getStatsByOwnerId` N+1 → Supabase RPC 함수로 서버 집계
**C3**: Json 필드 15개에 `safeParseJson<T>()` Zod 검증 적용
**C4**: DB CHECK 제약조건 5개 (board status, author_role, reports)
**C5**: `as unknown as Type` 캐스팅 → Zod parse 교체

---

### D. Firebase 제거 (Phase 4)

**D1**: `src/repositories/firebase/` 폴더 전체 삭제 (dead code)
**D2**: Firebase 유틸리티 삭제 (firebase.ts, firestore.ts, queryBuilder.ts, authFirestoreSync.ts, emulatorMode.ts)
**D3**: firebaseErrorMapper 삭제 + 3개 서비스의 import를 handleSupabaseError로 전환
**D4**: `src/lib/index.ts` Firebase re-export 제거
**D5**: Observability 서비스 Firebase → logger 스텁
**D6**: `src/constants/firebase.ts` → `database.ts` 리네임
**D7**: npm uninstall firebase 패키지 4개
**D8**: `.env.local`, `env.ts` Firebase 환경변수 제거

---

### E. 테스트 인프라

**E1**: jest.setup.js Firebase mock 제거 + Supabase mock 보강
**E2**: 12개 테스트 Timestamp → ISO string 교체
**E3**: Supabase Repository 테스트 5개 작성

---

## 데이터 흐름

```
[Client] → Supabase PostgREST → [PostgreSQL]
         → Supabase Realtime (notifications, applications, jobPostings, workLog 단건)
         → TanStack Query polling (workLog 목록 30s)
         → Supabase Edge Functions (10개)
```

## 에러 흐름

```
PostgrestError → POSTGREST_ERROR_MAP → INFRA_*/VALIDATION_* AppError
Supabase AuthError → AppAuthError
일반 Error → normalizeError → AppError(UNKNOWN)
```

## 테스트 전략

- 기존 3,501 테스트 유지 (추가 실패 0건)
- 새 Supabase Repository 테스트 5개 추가 (CRUD + 에러 + 페이지네이션)
- jest.setup.js Supabase mock으로 PostgREST 체이닝 패턴 테스트

## 리스크

| 리스크                                            | 완화                                                     |
| ------------------------------------------------- | -------------------------------------------------------- |
| firebaseErrorMapper 삭제 시 서비스 에러 처리 깨짐 | 3개 서비스의 try-catch를 handleSupabaseError로 사전 전환 |
| WorkLog polling 전환 시 UX 지연                   | 30초 간격 + staleTime 설정으로 체감 최소화               |
| SELECT \* → 컬럼 명시 시 누락 필드                | database.types.ts 기반으로 컬럼 목록 생성                |
| Firebase 패키지 제거 시 빌드 깨짐                 | 모든 import 정리 완료 후 마지막에 uninstall              |
