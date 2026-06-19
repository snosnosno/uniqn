---
area: domain
updated: 2026-06-19
status: current
sources:
  - CLAUDE.md
tags: [roles, user-role, staff-role, permissions, rbac]
---

# 역할 모델

**한 줄:** 앱 접근 권한(UserRole)과 포커룸 직무(StaffRole)는 완전히 다른 두 개념이다. (검증됨: CLAUDE.md)

## UserRole — 앱 접근 권한

검증됨 (CLAUDE.md 역할 섹션):
```
admin > employer > staff
```

| UserRole | 접근 경로 | 설명 |
|---|---|---|
| `admin` | `(admin)/` | 전체 관리 |
| `employer` | `(employer)/` | 구인자 — 공고 게시, 스태프 관리 |
| `staff` | `(app)/` | 구직자 — 공고 탐색·지원 |
| (비로그인) | `(public/)`, `(auth/)` | 없음 |

## StaffRole — 포커룸 직무

검증됨 (CLAUDE.md):
```
dealer / floor / serving
```

공고 내 역할 배정에 사용. UserRole과 독립 — staff UserRole이 아니어도 공고에는 StaffRole이 배정됨.

**혼동 주의**: `UserRole('staff')` ≠ `StaffRole('dealer'|'floor'|'serving')`.
- `UserRole('staff')` = 앱 권한(구직자)
- `StaffRole` = 공고 내 직무 분류

## 라우팅과 RLS 매핑

- UserRole은 expo-router 경로 그룹(`(admin)/`, `(employer)/`, `(app)/`)으로 구현 (주장: 코드 구조 기반).
- RLS `authenticated` 역할은 UserRole을 JWT `app_metadata.role`에서 읽음 (주장).

## 역할 에스컬레이션 방어

주장 (memory 기반): `prevent_role_escalation` DB 트리거로 UserRole 무단 승격 차단. employer 등록 신청 승인 흐름만 허용.

## 관련

- [[rls-model]] — RLS에서 authenticated role과 UserRole 매핑
- [[target-market]] — employer/staff 역할이 각각 어떤 타깃 사용자인지
- [[layers]] — 레이어별 권한 체크 위치
