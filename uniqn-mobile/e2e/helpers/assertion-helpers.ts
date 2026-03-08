/**
 * 커스텀 단언 헬퍼 — 한글 텍스트 상수 및 유틸리티
 */

/**
 * 공통 한글 텍스트 상수 (타이포 방지)
 */
export const TEXT = {
  // 인증
  LOGIN: '로그인',
  SIGNUP: '회원가입',
  LOGOUT: '로그아웃',
  FORGOT_PASSWORD: '비밀번호를 잊으셨나요?',
  EMAIL_PLACEHOLDER: '이메일을 입력하세요',
  PASSWORD_PLACEHOLDER: '비밀번호를 입력하세요',

  // 탭
  TAB_JOBS: '구인구직',
  TAB_SCHEDULE: '내 스케줄',
  TAB_EMPLOYER: '내 공고',
  TAB_PROFILE: '프로필',

  // 공통
  CONFIRM: '확인',
  CANCEL: '취소',
  SAVE: '저장',
  DELETE: '삭제',
  EDIT: '수정',
  CLOSE: '닫기',
  NEXT: '다음',
  PREVIOUS: '이전',
  SUBMIT: '제출',
  APPLY: '지원하기',
  SEARCH: '검색',

  // 에러
  REQUIRED_FIELD: '필수 입력 항목입니다',
  INVALID_EMAIL: '유효한 이메일',
  PASSWORD_MISMATCH: '비밀번호가 일치하지 않습니다',
  XSS_ERROR: '위험한 문자열이 포함되어 있습니다',

  // 상태
  LOADING: '로딩 중...',
  APP_LOADING: '앱 로딩 중...',
  NO_DATA: '데이터가 없습니다',
  NO_SCHEDULE: '스케줄이 없습니다',

  // 프로필 메뉴
  NOTICES: '공지사항',
  SETTINGS_CENTER: '설정센터',
  CUSTOMER_SUPPORT: '고객센터',
  ADMIN_DASHBOARD: '관리자 대시보드',

  // 설정
  SETTINGS: '설정',
  PROFILE_EDIT: '프로필 수정',
  CHANGE_PASSWORD: '비밀번호 변경',
  DELETE_ACCOUNT: '계정 삭제',
  TERMS: '이용약관',
  PRIVACY: '개인정보처리방침',

  // 구인자
  CREATE_POSTING: '공고 작성',
  MY_POSTINGS: '내 공고 관리',
  APPLICANTS: '지원자',
  SETTLEMENT: '정산',
} as const;

/**
 * 에러 메시지 상수
 */
export const ERROR_MESSAGES = {
  LOGIN_FAILED: '로그인에 실패했습니다',
  SIGNUP_FAILED: '회원가입에 실패했습니다',
  NETWORK_ERROR: '네트워크 오류가 발생했습니다',
  UNAUTHORIZED: '접근 권한이 없습니다',
  SESSION_EXPIRED: '세션이 만료되었습니다',
} as const;
