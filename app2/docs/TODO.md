# TODO 항목 정리

프로젝트 내 TODO/FIXME 주석 모음 및 향후 작업 계획

**마지막 업데이트**: 2025-10-04
**총 TODO 개수**: 14개

---

## 📋 카테고리별 분류

### 1. 미래 기능 준비 (7개)

#### StaffManagementTab.tsx
- **Line 375**: 대량 선택 기능 준비 완료
- **Line 381**: 가상화 기능 준비 완료
- **Line 801**: 대량 작업 기능 준비 완료
- **Line 954**: 대량 메시지 기능 준비 완료
- **Line 959**: 대량 상태 변경 기능 준비 완료

**우선순위**: 낮음
**계획**: v0.3.0에서 구현 예정

#### useUnifiedData.ts
- **Line 34**: UnifiedDataContext options 전달 로직

**우선순위**: 중간
**계획**: Context API 최적화 시 구현

---

### 2. 레거시 타입 (3개)

#### OptimizedUnifiedDataService.ts
- **Line 40**: LegacyApplication 타입 (현재 미사용)

**우선순위**: 낮음
**조치**: Phase 3 완료로 레거시 필드 제거 완료, 타입 정리만 남음

#### useStaffWorkData.ts
- **Line 6**: RolePayrollInfo 타입 (미래 급여 정보용)

**우선순위**: 낮음
**계획**: 급여 시스템 확장 시 활성화

#### MyApplicationsTab.tsx
- **Line 136**: 단일 지원 시간대 표시 컴포넌트 (미사용)

**우선순위**: 낮음
**조치**: 사용하지 않으면 제거 고려

---

### 3. 기능 구현 필요 (4개)

#### OptimizedUnifiedDataService.ts
- **Line 371**: 실제 사용자 역할 확인 로직 구현
- **Line 376**: 실제 사용자 역할 확인 로직 구현

**우선순위**: 높음
**계획**: 권한 시스템 강화 시 구현 (v0.2.4)

#### unifiedDataService.ts
- **Line 110**: 데이터 변환 유틸리티 (미사용)

**우선순위**: 낮음
**조치**: OptimizedUnifiedDataService로 이전 완료, 파일 정리 고려

#### setupEmulator.ts
- **Line 13**: where 필터링 기능 (미래용)

**우선순위**: 낮음
**계획**: 테스트 유틸리티 확장 시 구현

---

## 🎯 우선순위별 작업 계획

### 높음 (즉시 처리)
- [ ] 사용자 역할 확인 로직 구현 (OptimizedUnifiedDataService.ts:371, 376)

### 중간 (v0.2.4)
- [ ] UnifiedDataContext options 전달 로직 (useUnifiedData.ts:34)
- [ ] 미사용 코드 정리 (unifiedDataService.ts, MyApplicationsTab.tsx)

### 낮음 (v0.3.0)
- [ ] StaffManagementTab 대량 작업 기능 (5개 항목)
- [ ] 레거시 타입 정리
- [ ] 테스트 유틸리티 확장

---

## 📝 관련 문서
- [개발 가이드](../../docs/core/DEVELOPMENT_GUIDE.md)
- [변경 이력](../../CHANGELOG.md)
- [프로젝트 가이드](../../CLAUDE.md)
