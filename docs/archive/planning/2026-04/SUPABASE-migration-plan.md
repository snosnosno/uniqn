# Firebase → Supabase 이전 계획 (큰 틀)

## Context

UNIQN Mobile 앱의 Firebase → Supabase 전면 이전. **출시 전이므로 기존 데이터/회원 보존 불필요.** 이로 인해 데이터 마이그레이션, UID 매핑, 듀얼 런, Shadow Read 등이 모두 불필요 → 클린 컷오버 방식으로 진행.

Repository 패턴(16개 인터페이스)으로 Firebase가 잘 추상화되어 있어 구현체만 교체하면 됨.

---

## 이전 전략: 4단계 클린 컷오버

> 데이터/회원 이전 없음. Firebase 구현체를 Supabase 구현체로 교체하는 작업.

---

### Phase 1: 기반 + Auth (2~3주)

**목표**: Supabase 프로젝트 세팅 + PostgreSQL 스키마 설계 + 인증 교체

| 작업 | 설명 |
|------|------|
| Supabase 프로젝트 생성 | `ap-northeast-2` (서울) 리전 |
| `src/lib/supabase.ts` | Supabase 클라이언트 초기화 모듈 생성 |
| PostgreSQL 스키마 설계 | Firestore 13+ 컬렉션 → 관계형 테이블 + FK + 인덱스 |
| RLS 정책 작성 | `firestore.rules` 3,204줄 → PostgreSQL RLS로 변환 |
| Auth 프로바이더 설정 | 이메일/비번, Apple Sign-In, Phone SMS (Twilio) |
| Auth 서비스 교체 | `authCoreService.ts`, `authBridge.ts`, `socialLoginService.ts` → Supabase Auth |
| Custom Claims → app_metadata | `role: admin/employer/staff` → `raw_app_meta_data` |
| PortOne 본인인증 | Cloud Function → Edge Function으로 포팅 |

**핵심 파일**:
- `src/lib/firebase.ts` → `src/lib/supabase.ts` (신규)
- `src/services/auth/authCoreService.ts` (교체)
- `src/lib/authBridge.ts` (제거 — Dual SDK 불필요)
- `src/services/auth/socialLoginService.ts` (교체)
- `src/services/auth/appleAuthService.ts` (교체)
- `src/hooks/auth/usePhoneSMS.ts` (교체)

**완료 기준**: 이메일/Apple/Phone 로그인 + 역할 기반 접근 제어 동작 확인

---

### Phase 2: 데이터 레이어 교체 (4~5주)

**목표**: 16개 Firebase Repository → Supabase Repository로 전면 교체

| 작업 | 설명 |
|------|------|
| Supabase Repository 구현 | 16개 인터페이스의 read/write 메서드 전체 구현 |
| 트랜잭션 변환 | Firestore `runTransaction` → PostgreSQL 트랜잭션/RPC |
| 배치 쓰기 변환 | `writeBatch` → PostgreSQL 트랜잭션 (500건 제한 해제) |
| 실시간 교체 | `RealtimeManager` → Supabase Realtime (Postgres Changes) |
| QueryBuilder 교체 | Firestore QueryBuilder → Supabase PostgREST 체이닝 |
| FieldValue 대응 | `serverTimestamp()` → `now()`, `increment()` → SQL 연산 등 |

**구현 순서** (도메인별):
1. `UserRepository` (Auth와 직결)
2. `JobPostingRepository` + `ApplicationRepository` (핵심 비즈니스)
3. `WorkLogRepository` + `ConfirmedStaffRepository` + `SettlementRepository`
4. `NotificationRepository` + `BoardRepository` + `AnnouncementRepository`
5. 나머지: `ReviewRepository`, `ReportRepository`, `InquiryRepository`, `TemplateRepository`, `EventQRRepository`, `AdminRepository`

**핵심 파일**:
- `src/repositories/index.ts` (스왑 포인트)
- `src/repositories/interfaces/` (16개 — 변경 없음)
- `src/repositories/firebase/` → `src/repositories/supabase/` (전면 교체)
- `src/shared/realtime/RealtimeManager.ts` (교체)
- `src/utils/firestore.ts` → `src/utils/supabase.ts` (교체)

**완료 기준**: 모든 Repository의 CRUD + 실시간 구독 동작 확인

---

### Phase 3: Functions + Storage + 기타 서비스 (3~4주)

**목표**: Cloud Functions, Storage, Remote Config, 푸시 알림 교체

#### Cloud Functions → Edge Functions + PG Triggers

| 카테고리 | 수량 | Supabase 대응 |
|----------|------|---------------|
| Callable (인증 외) | 21개 | Edge Functions |
| Firestore 트리거 | 21개 | PG trigger + Database Webhook + Edge Function |
| 스케줄 함수 | 8개 | `pg_cron` + Edge Function |

#### Storage

| 작업 | 설명 |
|------|------|
| Storage 버킷 생성 | 9개 경로 → Supabase Storage 버킷 + RLS |
| `storageService.ts` 교체 | Firebase Storage → Supabase Storage API |
| 파일 검증 | 타입/크기 제한 → Storage Policy + Edge Function |

#### 기타

| 작업 | 설명 |
|------|------|
| Remote Config | 6개 키 → `app_config` 테이블 + 캐시 |
| 푸시 알림 | Edge Functions에서 Expo Push API 호출 (현재도 Expo SDK 사용) |
| `versionService.ts` | Remote Config → Supabase 테이블 읽기로 교체 |

**핵심 파일**:
- `functions/` 전체 → `supabase/functions/` (Edge Functions)
- `src/services/storage/storageService.ts` (교체)
- `src/services/infra/versionService.ts` (교체)

**완료 기준**: 전체 기능 E2E 동작 확인

---

### Phase 4: Firebase 제거 + 정리 (1~2주)

**목표**: Firebase 코드/설정 완전 제거. 단일 Supabase 백엔드.

| 작업 | 설명 |
|------|------|
| Firebase SDK 제거 | `@react-native-firebase/*`, `firebase/*` 패키지 삭제 |
| Firebase Repository 삭제 | `src/repositories/firebase/` 전체 삭제 |
| Firebase 유틸 삭제 | `src/lib/firebase.ts`, `src/lib/authBridge.ts`, `src/utils/firestore.ts` 등 |
| 설정 파일 삭제 | `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `firebase.json` |
| Cloud Functions 삭제 | `functions/` 디렉토리 삭제 (git 히스토리에 보존) |
| 네이티브 설정 정리 | `google-services.json`, `GoogleService-Info.plist` 제거, `app.config.ts` 업데이트 |
| CLAUDE.md 업데이트 | 기술 스택, 아키텍처, 명령어 등 Supabase 반영 |
| Firebase 프로젝트 삭제 | 더 이상 불필요 |

**완료 기준**: `npm run quality` 통과 + E2E 전체 통과 + Firebase import 0건

---

## 전체 일정 요약

```
Phase 1 ██████░░░░░░░░░░░░░░  2~3주  기반 + Auth
Phase 2 ░░░░░░██████████░░░░  4~5주  데이터 레이어
Phase 3 ░░░░░░░░░░░░████████  3~4주  Functions + Storage
Phase 4 ░░░░░░░░░░░░░░░░░░██  1~2주  정리
──────────────────────────────
총 약 10~14주 (2.5~3.5개월)
```

## 핵심 리스크 (데이터 이전 없으므로 대폭 감소)

| 리스크 | 대응 |
|--------|------|
| 오프라인 동기화 상실 | TanStack Query 캐시 + MMKV로 대응. 필요 시 PowerSync 검토 |
| RLS 정책 누락 | Firestore 규칙과 1:1 대조 보안 감사 |
| Phone SMS 비용 증가 | Twilio 과금 구조 사전 확인. PortOne 본인인증으로 대체 검토 |
| 실시간 패턴 차이 | 초기 데이터 로드 + Realtime 구독 조합 패턴으로 전환 |
| Edge Function Deno 호환 | `@portone/server-sdk`, `expo-server-sdk` npm 호환 사전 확인 |
| Supabase RN 안정성 | `supabase-js`의 React Native 환경 실시간/Storage 검증 |

## 검증 방법

- 각 Phase 완료 시 `npm run quality` (type-check + lint + format:check) 통과
- E2E 테스트 (`npm run e2e`) Supabase 백엔드로 전체 통과
- Phase 2 완료 후 전체 CRUD 시나리오 수동 QA
- Phase 3 완료 후 알림/Storage/스케줄 함수 동작 확인
