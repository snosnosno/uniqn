> 운영/출고 문서
>
> 이 문서는 고정공고 1차 범위의 현재 출고 상태, 검증 결과, 배포 전 확인 항목을 정리한 문서입니다.

# 고정공고 1차 마감 정리

작성일: 2026-04-05  
상태: Ready for app rollout after final release review

## 1. 범위 요약

고정공고 1차의 필수 범위는 완료 상태로 본다.

- 고정공고 생성
- 앱 내부 상세
- 역할 1개 지원
- 역할 1개 확정
- 내 공고 관리

추가로 2차 선행 작업 중 `고정공고 편집 지원`까지 코드 반영이 완료되었다.

## 2. 현재 계약

1차 기준 계약은 그대로 유지한다.

- 공고당 지원 1건
- 지원당 역할 1개
- 확정당 역할 1개
- fixed 확정 시 WorkLog 생성 없음
- 앱 홈은 `fixed` 칩 전용 진입 유지
- 공개 상세/공유 지원/검색 노출은 계속 차단
- 정산/QR/취소요청/확정취소/실근무일 운영은 계속 차단

## 3. 구현 상태

핵심 구현 상태:

- fixed 생성 가능
- fixed 상세/지원 가능
- fixed 확정 가능
- fixed 내 공고 관리 가능
- fixed 편집 가능

confirmed 지원자가 있는 경우에는 기존 제약을 유지한다.

- 일정 수정 불가
- 역할 수정 불가

## 4. 검증 기록

확인 완료:

- Firestore Rules 배포 완료
  - `firestore.rules`
  - 배포 프로젝트: `tholdem-ebc18`
- 타입 검사 통과
  - `cd uniqn-mobile && npm run type-check`
- fixed 관련 focused Jest 통과
  - `src/utils/job-posting/__tests__/submission.test.ts`
  - `src/services/jobs/__tests__/jobManagementService.test.ts`
  - `src/repositories/firebase/__tests__/JobPostingRepository.test.ts`
- fixed 관련 rules / transaction 회귀는 이전 단계에서 통과 확인
- 내부 QA 완료
  - 생성 -> 상세 -> 지원 -> 확정
  - 제외 화면 직접 진입 차단

## 5. 출고 전 마지막 체크

앱 출고 직전에는 아래만 다시 확인한다.

1. fixed 관련 변경만 기준으로 최종 diff review
2. fixed와 무관한 변경이 섞이지 않았는지 확인
3. 앱 배포/OTA 반영 방식 결정
4. 배포 직후 아래 시나리오 1회 재확인
   - 고정공고 생성
   - 역할 1개 지원
   - 역할 1개 확정
   - 차단 화면 직접 진입

## 6. 차단 유지 대상

아래는 1차 출고 범위에서 계속 제외한다.

- 공개 상세
- 공유 지원
- 검색 노출
- 정산
- QR
- WorkLog 생성
- 취소요청
- 확정취소
- 재배치
- no-show 처리

## 7. 운영 메모

- fixed는 dated 예외가 아니라 별도 운영 플로우로 계속 취급한다.
- mixed all-feed 통합은 하지 않는다.
- fixed는 당분간 내부 운영 중심으로만 확장한다.
- 2차 남은 범위는 별도 문서 `docs/planning/2026-04-05-fixed-posting-phase2-remaining-work.md`를 따른다.
