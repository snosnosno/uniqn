# UNIQN Specs 디렉토리 안내

**최종 업데이트**: 2026년 2월 1일

---

## 폴더 구조 안내

### 현재 사용 중 (Active)

| 폴더 | 대상 | 설명 |
|------|------|------|
| `react-native-app/` | **uniqn-mobile/** | React Native + Expo 모바일앱 스펙 (현재 주력) |

---

### ⚠️ 레거시 (DEPRECATED)

> **중요**: 아래 폴더들은 **레거시 웹앱(app2/)**용 스펙입니다.
>
> app2/는 2025년 말부터 개발이 중단되었으며, 현재 모든 개발은 **uniqn-mobile/**에서 진행됩니다.
>
> 이 폴더들은 **역사적 참고용**으로만 보관됩니다.

| 폴더 | 대상 | 상태 | 설명 |
|------|------|------|------|
| `001-authcontext-tests/` | app2/ | DEPRECATED | AuthContext 테스트 스펙 |
| `001-hooks-tests/` | app2/ | DEPRECATED | Hooks 테스트 스펙 |
| `001-job-posting-form-split/` | app2/ | DEPRECATED | JobPostingForm 리팩토링 스펙 |
| `001-schedule-modal-split/` | app2/ | DEPRECATED | ScheduleModal 분리 스펙 |
| `001-tournament-approval-system/` | app2/ | DEPRECATED | 대회공고 승인 시스템 스펙 |
| `001-zustand-migration/` | app2/ | DEPRECATED | Zustand 마이그레이션 스펙 |
| `002-phase3-integration/` | app2/ | DEPRECATED | Phase 3 통합 스펙 |
| `002-unifieddatacontext-tests/` | app2/ | DEPRECATED | UnifiedDataContext 테스트 스펙 |
| `003-ui-component-tests/` | app2/ | DEPRECATED | UI 컴포넌트 테스트 스펙 |

---

## 현재 프로젝트 정보

- **주력 플랫폼**: React Native + Expo (uniqn-mobile/)
- **모바일앱 버전**: v1.0.0
- **결제 시스템**: RevenueCat 기반 💎 하트/다이아 포인트 시스템
- **기술 스택**: Expo SDK 54, React Native 0.81.5, TypeScript 5.9.2

## 참고 문서

- **개발 가이드**: [CLAUDE.md](../CLAUDE.md)
- **모바일앱 스펙**: [react-native-app/00-overview.md](react-native-app/00-overview.md)
- **포인트 시스템**: [docs/features/payment/MODEL_B_CHIP_SYSTEM_FINAL.md](../docs/features/payment/MODEL_B_CHIP_SYSTEM_FINAL.md)
