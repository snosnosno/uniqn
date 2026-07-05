> 최종 검증: 2026-07-05 (문서 대수술 — 5파일 동일 복제본 해체, 코드 실측 기반 신규 작성)

# Feature Flag 가이드

이 문서는 `uniqn-mobile/`에 실제로 존재하는 Feature Flag 구현만 설명합니다.

## ⚠️ 함정: 이 이름들은 존재하지 않는다

과거 문서(및 유사 프로젝트 관습)에서 흔한 다음 요소들은 **현재 코드베이스에 없습니다.** 검색·참조 금지:

- `feature_flags` 테이블(Supabase) — 존재하지 않음
- `src/services/observability/featureFlagService.ts` — 존재하지 않음
- `src/hooks/useFeatureFlag.ts` — 존재하지 않음
- `app/(admin)/settings.tsx` — 관리자 플래그 토글 화면 자체가 없음(admin 폴더에 settings 라우트 없음)

플래그 저장소는 **`app_config` 테이블**(범용 key-value 설정 테이블) 하나뿐입니다.

## 기준 파일

- `uniqn-mobile/src/config/featureFlags.ts` — 빌드타임 상수(OTA 롤백 안전망)
- `uniqn-mobile/src/hooks/useWeeklyGridEnabled.ts` — 원격 플래그 훅
- `uniqn-mobile/src/services/appConfigService.ts` — `app_config` 읽기 서비스
- `uniqn-mobile/src/domains/weeklyGrid/weeklyGridFlag.ts` — 원격 값 zod 파서(도메인 순수 함수)
- `uniqn-mobile/supabase/migrations/20260630000300_weekly_grid_app_config_flag.sql` — 시드 마이그레이션

## 현재 플래그 목록

빌드타임 상수(`featureFlags.ts`, false로 바꾸면 OTA로 즉시 롤백):

- `home_dashboard_enabled: true`
- `weekly_grid_enabled: false` — 원격 `app_config` 조회 실패/로딩 중 fallback 값

원격(동적) 플래그는 현재 `weekly_grid_enabled` 1개뿐이며, `app_config` 테이블에 `{"enabled": boolean}` 형태 jsonb로 저장됩니다. 기본 시드값은 `{"enabled": false}`(안전 기본 OFF).

`app_config` 테이블은 이 플래그 외에도 `versionService.ts`가 읽는 `force_update_version`/`latest_version`/`recommended_version`/`release_notes`/`maintenance_mode` 키를 함께 보관하는 범용 설정 테이블입니다(플래그 전용 테이블 아님). 과거 `monetization` 키는 지갑/IAP 제거 후 `DELETE`로 정리되었습니다(`20260623120000_drop_app_config_monetization.sql`).

## 클라이언트 소비 경로

```
useWeeklyGridEnabled() (hook)
  → TanStack Query (queryKeys.appConfig.weeklyGridEnabled(), staleTime = cachingPolicies.stable = 60분)
  → getWeeklyGridFlagRaw() (appConfigService.ts)
      → supabase.from('app_config').select('value').eq('key','weekly_grid_enabled').maybeSingle()
  → parseWeeklyGridFlag(raw, fallback) (weeklyGridFlag.ts, zod safeParse)
      → 실패/null/로딩 중이면 featureFlags.weekly_grid_enabled 로 fallback
```

훅은 Supabase를 직접 호출하지 않고 service를 경유합니다(아키텍처 규칙 준수). 현재 소비처: `app/(employer)/weekly-grid.tsx`, `app/(app)/(tabs)/employer.tsx`.

## ON/OFF 절차

관리자 UI가 없으므로 Supabase에서 직접 값을 갱신합니다.

```sql
UPDATE public.app_config
SET value = jsonb_build_object('enabled', true), updated_at = now()
WHERE key = 'weekly_grid_enabled';
```

- 마이그레이션은 `ON CONFLICT (key) DO NOTHING`으로 시드하므로, 이미 운영자가 토글한 값을 재적용(`db reset`/재배포)이 덮어쓰지 않습니다.
- 마이그레이션 파일 주석 기준: prod 적용은 하드게이트(사용자 승인) 대상이며, 적용되더라도 기본값은 OFF로 유지됩니다.

## 새 원격 플래그 추가 절차 (weekly_grid_enabled 패턴 기준)

1. `app_config`에 `{key, value: {"enabled": bool}, description}` 시드 마이그레이션 추가(`ON CONFLICT (key) DO NOTHING`).
2. `featureFlags.ts`에 빌드타임 fallback 상수 추가.
3. 도메인 순수 파서(zod safeParse, `{enabled: z.boolean()}`) 작성.
4. `appConfigService.ts`에 raw value 조회 함수 추가.
5. `useXxxEnabled()` 훅에서 TanStack Query + 파서 조합으로 노출.
