/**
 * 역할 처리 모듈
 *
 * @description Phase 4 - 역할 처리 통합
 * 사용자 역할과 직무 역할 관련 타입, 유틸리티를 중앙에서 export
 */

// 타입
export type { ResolvedRole, StaffRoleInput, AssignmentRoleInput, UserRole } from './types';

// 상수
export { USER_ROLE_HIERARCHY, USER_ROLE_DISPLAY_NAMES, VALID_USER_ROLES } from './types';

// 역할 처리 유틸리티
export { RoleResolver } from './RoleResolver';
