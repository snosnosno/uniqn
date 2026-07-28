---
area: domain
updated: 2026-07-28
status: current
sources:
  - uniqn-mobile/src/types/role.ts
  - uniqn-mobile/src/constants/jobPosting.ts
  - uniqn-mobile/app
  - CLAUDE.md
tags: [roles, user-role, staff-role, permissions, rbac]
---

# 역할 모델

**한 줄:** 앱 접근 권한(UserRole 3종)과 현장 직무(StaffRole 6종)는 완전히 다른 두 개념인데 **`'staff'` 라는 값이 양쪽에 있다**. (검증됨: `uniqn-mobile/src/types/role.ts:57,100`)

## UserRole — 앱 접근 권한

검증됨 (`uniqn-mobile/src/types/role.ts:57`):
```
admin > employer > staff
```

| UserRole | 접근 경로 | 설명 |
|---|---|---|
| `admin` | `(admin)/` | 전체 관리 |
| `employer` | `(employer)/` | 구인자 — 공고 게시, 스태프 관리 |
| `staff` | `(app)/` | 구직자 — 공고 탐색·지원 |
| (비로그인) | `(public)/`, `(auth)/` | 없음 |
| **(역할 무관, 인증만)** | `(ops)/` | 라이브 대회 운영 — **UserRole 체크 없음**. 데이터 접근은 RLS 가 owner/workspace 로 통제(`uniqn-mobile/app/(ops)/_layout.tsx:1-3`, **검증됨**). [[ops-engine]] |

## StaffRole — 현장 직무

검증됨 (`uniqn-mobile/src/types/role.ts:100`) — **6종**:
```
dealer / floor / serving / manager / staff / other
```

한글 라벨은 `STAFF_ROLE_LABELS`(`src/types/role.ts:102-109`), 아이콘 포함 옵션 목록은 `STAFF_ROLES`(`src/constants/jobPosting.ts:78-85`) — 두 곳 모두 6키로 정합. `other` 는 `customRole` 필드와 짝으로 쓴다. v2.1.0 통합에서 `chiprunner → floor` 로 흡수되고 `admin` 은 제거됐다(UserRole 혼동 방지).

> ⚠️ 2026-07-28 정정: 이 페이지는 오랫동안 StaffRole 을 `dealer/floor/serving` **3종**으로 기록했다. CLAUDE.md 의 축약 표기를 그대로 옮긴 것이 원인이며, 실제로는 처음부터 6종이었다. **역할 열거의 SSOT 는 `src/types/role.ts` 이지 CLAUDE.md 가 아니다.**

공고 내 역할 배정에 사용. UserRole과 독립 — staff UserRole이 아니어도 공고에는 StaffRole이 배정됨.

**혼동 주의 — 같은 문자열 `'staff'` 가 두 타입에 동시에 존재한다:**
- `UserRole('staff')` = 앱 권한(구직자)
- `StaffRole('staff')` = 현장 직무 '직원'(딜러/플로어/서빙과 병렬)

문자열만 보고 분기하면 두 개념이 섞인다 — 타입 가드(`isStaffRole`, `src/types/role.ts`)를 거칠 것.

## 라우팅과 RLS 매핑

- UserRole은 expo-router 경로 그룹(`(admin)/`, `(employer)/`, `(app)/`)으로 구현 (주장: 코드 구조 기반).
- RLS `authenticated` 역할은 UserRole을 JWT `app_metadata.role`에서 읽음 (주장).

## 역할 에스컬레이션 방어

주장 (memory 기반): `prevent_role_escalation` DB 트리거로 UserRole 무단 승격 차단. employer 등록 신청 승인 흐름만 허용.

## 관련

- [[rls-model]] — RLS에서 authenticated role과 UserRole 매핑
- [[target-market]] — employer/staff 역할이 각각 어떤 타깃 사용자인지
- [[layers]] — 레이어별 권한 체크 위치
- [[ops-engine]] — StaffRole 이 대회 딜러 테이블 배정에 쓰임. `(ops)/` 라우트는 UserRole 게이트가 없다
