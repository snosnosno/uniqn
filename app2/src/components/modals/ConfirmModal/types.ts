/**
 * ConfirmModal 타입 정의
 *
 * 재사용 가능한 확인 모달 컴포넌트의 타입 시스템
 * 텍스트 입력 검증, 위험 작업 확인 등 다양한 시나리오 지원
 */

/**
 * 텍스트 입력 검증 설정
 * 전체삭제 등 위험한 작업에서 사용자에게 특정 텍스트 입력을 요구할 때 사용
 */
export interface TextInputValidation {
  /** 입력 필드의 placeholder 텍스트 */
  placeholder: string;
  /** 사용자가 입력해야 하는 정확한 값 */
  confirmValue: string;
  /** 대소문자 구분 여부 (기본값: true) */
  caseSensitive?: boolean;
}

/**
 * ConfirmModal 컴포넌트 Props
 */
export interface ConfirmModalProps {
  /** 모달 열림/닫힘 상태 */
  isOpen: boolean;
  /** 모달 닫기 콜백 */
  onClose: () => void;
  /** 확인 버튼 클릭 시 콜백 */
  onConfirm: () => void | Promise<void>;
  /** 모달 제목 */
  title: string;
  /** 모달 메시지 (줄바꿈 지원) */
  message: string;
  /** 확인 버튼 텍스트 (기본값: '확인') */
  confirmText?: string;
  /** 취소 버튼 텍스트 (기본값: '취소') */
  cancelText?: string;
  /** 위험한 작업 여부 - true시 빨간색 경고 스타일 적용 */
  isDangerous?: boolean;
  /** 로딩 상태 - true시 버튼 비활성화 및 스피너 표시 */
  isLoading?: boolean;
  /** 텍스트 입력 검증 설정 */
  requireTextInput?: TextInputValidation;
}

/**
 * useConfirmInput 훅의 반환 타입
 */
export interface UseConfirmInputReturn {
  /** 현재 입력값 */
  inputValue: string;
  /** 입력값 변경 핸들러 */
  setInputValue: (value: string) => void;
  /** 입력값 유효성 여부 */
  isValid: boolean;
  /** 입력값 초기화 */
  reset: () => void;
  /** 에러 메시지 (유효하지 않을 때만) */
  errorMessage: string | null;
}
