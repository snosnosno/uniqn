# 롤백 절차 가이드

최종 업데이트: 2026-04-18  
기준 코드: `uniqn-mobile/`, `uniqn-mobile/supabase/`

이 문서는 현재 배포 경로 기준 롤백 절차만 다룹니다. 백엔드는 Supabase(Auth / PostgreSQL / Edge Functions / Storage) 기준입니다.

## 우선순위

1. 웹 export 재배포
2. Supabase Edge Functions 재배포 (이전 버전)
3. Supabase RLS / 스키마 마이그레이션 복원
4. 데이터 복구 (Point-In-Time Recovery 또는 백업)

## 웹 롤백

현재 웹은 `npm run build:web` + `npm run deploy:cloudflare` 경로를 사용합니다.

```bash
cd uniqn-mobile
npm run deploy:cloudflare
```

이전 정상 커밋으로 되돌린 뒤 다시 배포하는 것이 가장 안전합니다.

## Edge Functions 롤백

### 전체 재배포 (stable 커밋 기준)

```bash
git checkout <stable-commit>
cd uniqn-mobile
npx supabase functions deploy
```

### 특정 함수만 롤백

```bash
cd uniqn-mobile
git checkout <stable-commit> -- supabase/functions/<FUNCTION_NAME>
npx supabase functions deploy <FUNCTION_NAME>
```

## Supabase RLS / 스키마 롤백

RLS 정책과 테이블 스키마는 `uniqn-mobile/supabase/migrations/*.sql` 로 관리됩니다. 되돌릴 때는 역방향 마이그레이션을 새로 추가하는 것이 원칙입니다.

> **❗ prod 적용은 MCP `apply_migration` 전용 — `npx supabase db push` 금지.**

```bash
cd uniqn-mobile

# 1) 문제 마이그레이션을 되돌리는 새 마이그레이션 파일 생성
npx supabase migration new revert_<name>

# 2) DROP POLICY / ALTER TABLE 등 역방향 SQL 작성 후
#    Claude Code의 mcp__supabase__apply_migration 호출로 prod에 적용
```

긴급 시에는 Supabase Dashboard의 "Database > Migrations"에서 이전 상태로 즉시 복원하거나, Point-In-Time Recovery로 특정 시점의 DB 상태로 복구할 수 있습니다.

## 로그 확인

Edge Function 로그는 Supabase Dashboard → Edge Functions → Logs 또는 MCP `get_logs`로 확인합니다 (CLI 2.109 기준 `supabase functions logs` 서브커맨드는 존재하지 않음).

Supabase Dashboard의 Logs / Database / Auth 섹션에서도 실시간 로그 확인이 가능합니다. 추가로 Sentry와 앱 관리자 통계를 함께 확인합니다.

## 긴급 체크리스트

- 문제 범위 확인 (웹 / Edge Function / DB 스키마 / RLS / 데이터)
- 사용자 영향 판단
- 웹 / Edge Functions / RLS·스키마 중 어디를 먼저 되돌릴지 결정
- 롤백 후 로그인, 공고 조회, 관리자 주요 화면 재확인
- 인시던트 기록 남기기
