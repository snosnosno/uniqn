/**
 * UNIQN Mobile - 인앱 메시지 타입 정의
 *
 * @description 인앱 배너, 모달, 풀스크린 메시지 타입
 * @version 1.0.0
 */

import type { UserRole } from './role';

// ============================================================================
// Base Types
// ============================================================================

/**
 * 인앱 메시지 유형
 */
export type InAppMessageType = 'banner' | 'modal' | 'fullscreen';

/**
 * 메시지 우선순위
 */
export type InAppMessagePriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * 메시지 표시 빈도
 */
export type InAppMessageFrequency =
  | 'once' // 한 번만
  | 'once_per_session' // 세션당 한 번
  | 'daily' // 하루에 한 번
  | 'always'; // 조건 충족 시 항상

/**
 * 메시지 액션 유형
 */
export type InAppMessageActionType =
  | 'dismiss' // 단순 닫기
  | 'link' // 내부/외부 링크
  | 'deeplink' // 딥링크
  | 'update' // 앱 업데이트
  | 'callback'; // 커스텀 콜백

// ============================================================================
// In-App Message
// ============================================================================

/**
 * 인앱 메시지 액션
 */
export interface InAppMessageAction {
  /** 액션 유형 */
  type: InAppMessageActionType;
  /** 버튼 텍스트 */
  buttonText?: string;
  /** 링크 URL (type: 'link' | 'deeplink') */
  url?: string;
  /** 콜백 ID (type: 'callback') */
  callbackId?: string;
}

/**
 * 타겟 오디언스 조건
 */
export interface InAppMessageAudience {
  /** 타겟 유형 */
  type: 'all' | 'roles' | 'users';
  /** 대상 역할 (type: 'roles') */
  roles?: UserRole[];
  /** 대상 사용자 ID (type: 'users') */
  userIds?: string[];
}

/**
 * 표시 조건
 */
export interface InAppMessageConditions {
  /** 최소 앱 버전 */
  minAppVersion?: string;
  /** 최대 앱 버전 */
  maxAppVersion?: string;
  /** 시작 일시 (ISO 8601) */
  startDate?: string;
  /** 종료 일시 (ISO 8601) */
  endDate?: string;
  /** 표시 빈도 */
  frequency?: InAppMessageFrequency;
  /** 특정 화면에서만 표시 */
  screens?: string[];
  /** 플랫폼 필터 */
  platforms?: ('ios' | 'android' | 'web')[];
}

/**
 * 인앱 메시지
 */
export interface InAppMessage {
  /** 고유 ID */
  id: string;
  /** 메시지 유형 */
  type: InAppMessageType;
  /** 제목 */
  title: string;
  /** 본문 내용 */
  content: string;
  /** 우선순위 */
  priority: InAppMessagePriority;
  /** 타겟 오디언스 */
  targetAudience: InAppMessageAudience;
  /** 표시 조건 */
  conditions?: InAppMessageConditions;
  /** 주요 액션 (확인 버튼) */
  primaryAction?: InAppMessageAction;
  /** 보조 액션 (취소 버튼) */
  secondaryAction?: InAppMessageAction;
  /** 이미지 URL */
  imageUrl?: string;
  /** 아이콘 (이모지 또는 아이콘 이름) */
  icon?: string;
  /** 배경색 (배너용) */
  backgroundColor?: string;
  /** 텍스트 색상 */
  textColor?: string;
  /** 닫기 버튼 표시 여부 */
  dismissible?: boolean;
  /** 자동 닫기 시간 (ms, 배너용) */
  autoDismissMs?: number;
  /** 메타데이터 */
  metadata?: Record<string, unknown>;
  /** 활성화 여부 */
  isActive: boolean;
  /** 다시 보지 않기 옵션 표시 여부 */
  showDontShowAgain?: boolean;
}

// ============================================================================
// Store Types
// ============================================================================

/**
 * 메시지 표시 이력
 */
export interface InAppMessageHistory {
  /** 메시지 ID */
  messageId: string;
  /** 마지막 표시 시각 */
  lastShownAt: string;
  /** 표시 횟수 */
  shownCount: number;
  /** 닫힌 여부 */
  dismissed: boolean;
}

/**
 * 인앱 메시지 스토어 상태
 */
export interface InAppMessageState {
  /** 현재 표시할 메시지 큐 */
  messageQueue: InAppMessage[];
  /** 현재 표시 중인 메시지 */
  currentMessage: InAppMessage | null;
  /** 표시 이력 */
  history: Record<string, InAppMessageHistory>;
  /** 모든 메시지 목록 (서버에서 받은) */
  allMessages: InAppMessage[];
  /** 로딩 상태 */
  isLoading: boolean;
  /** 세션 내 표시된 메시지 ID 목록 (비영구) */
  sessionShownIds: string[];
}

/**
 * 인앱 메시지 스토어 액션
 */
export interface InAppMessageActions {
  /** 메시지 목록 설정 */
  setMessages: (messages: InAppMessage[]) => void;
  /** 큐에 메시지 추가 */
  enqueueMessage: (message: InAppMessage) => void;
  /** 다음 메시지 표시 */
  showNextMessage: () => void;
  /** 현재 메시지 닫기 */
  dismissCurrentMessage: () => void;
  /** 메시지 이력 기록 */
  recordMessageShown: (messageId: string) => void;
  /** 메시지 영구 닫기 */
  dismissMessagePermanently: (messageId: string) => void;
  /** 이력 초기화 */
  clearHistory: () => void;
  /** 로딩 상태 설정 */
  setLoading: (loading: boolean) => void;
  /** 세션 표시 ID 추가 */
  addSessionShownId: (messageId: string) => void;
  /** 세션 표시 여부 확인 */
  hasSessionShownId: (messageId: string) => boolean;
  /** 세션 ID 목록 초기화 */
  resetSessionIds: () => void;
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * 메시지 필터 조건
 */
export interface InAppMessageFilter {
  /** 현재 사용자 역할 */
  userRole?: UserRole | null;
  /** 현재 사용자 ID */
  userId?: string;
  /** 현재 앱 버전 */
  appVersion?: string;
  /** 현재 플랫폼 */
  platform?: 'ios' | 'android' | 'web';
  /** 현재 화면 */
  currentScreen?: string;
}

/**
 * Remote Config에서 받은 메시지 데이터
 */
export interface RemoteConfigMessages {
  /** 메시지 목록 */
  messages: InAppMessage[];
  /** 버전 */
  version: number;
  /** 마지막 업데이트 */
  updatedAt: string;
}
