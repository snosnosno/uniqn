/**
 * gridWriteService — 주간 배치 그리드 쓰기 변이의 Service 경계.
 *
 * 아키텍처(Presentation → Hooks → Service → Repository) 준수: 그리드 쓰기 변이는 Repository
 * 직접호출이 아니라 이 Service 를 경유한다. (읽기 전용 TanStack 조회만 Repository 직접호출 허용.)
 * 현재는 얇은 위임이지만, 향후 변이 전후 오케스트레이션(권한/낙관 무효화/감사)의 단일 지점이 된다.
 * 날짜 정규화(E5)·색상 화이트리스트·메모 XSS 검증은 RPC/레포 경계가 담당(여기서 중복하지 않는다).
 */
import { weeklyGridRepository } from '@/repositories/weeklyGrid';
import {
  workLogRepository,
  jobPostingRepository,
  type UpdateSlotInput,
  type SetVenueRoleSalaryInput,
} from '@/repositories';
import { cancelConfirmedStaffConfirmation } from '@/services/work/confirmedStaffService';
import type { VenueContainer } from '@/domains/weeklyGrid';
import type { DeleteConfirmedStaffInput } from '@/types';

/** 운영처 날짜별 목표인원(soft-target) 저장. 날짜 정규화(E5)·권한은 RPC(레포 경계)가 담당. */
export function setVenueSoftTarget(venueId: string, date: string, count: number): Promise<void> {
  return weeklyGridRepository.setVenueSoftTarget(venueId, date, count);
}

/** 지점 역할별 단가 upsert/삭제(salary:null=삭제). 권한·검증은 RPC(레포 경계)가 담당. */
export function setVenueRoleSalary(venueId: string, input: SetVenueRoleSalaryInput): Promise<void> {
  return weeklyGridRepository.setVenueRoleSalary(venueId, input);
}

/** 배치 슬롯 편집(시간·역할·색상·메모). 색상 화이트리스트·메모 XSS 검증은 레포 경계가 담당. */
export function updateSlot(workLogId: string, input: UpdateSlotInput): Promise<void> {
  return workLogRepository.updateSlot(workLogId, input);
}

/**
 * 배치 슬롯 빼기. 직접추가분(applicationId 없음)=remove_direct_staff, 지원확정분=확정해제 RPC —
 * 이 분기는 confirmedStaffService.cancelConfirmedStaffConfirmation 이 담당(removeDirectStaff
 * 직접 호출 금지: 공고 스팬 슬롯에서 NOT_DIRECT_STAFF). 권한 게이트는 RPC 경계.
 */
export function deleteSlot(input: DeleteConfirmedStaffInput): Promise<void> {
  return cancelConfirmedStaffConfirmation(input);
}

/**
 * 운영처 컨테이너 생성(get-or-create, 멱등). 이름 XSS 검증(S1)·워크스페이스 권한 게이트는
 * 레포/RPC 경계가 담당. v1 은 kind='dated' 고정(날짜 기반 그리드 전제).
 */
export function createVenueContainer(workspaceId: string, name: string): Promise<VenueContainer> {
  return jobPostingRepository.getOrCreateVenueContainer(workspaceId, { name, kind: 'dated' });
}
