// react-i18next 모킹
const translations = {
  'attendance.status.notStarted': '근무 전',
  'attendance.status.present': '출근',
  'attendance.status.checkedIn': '출근',
  'attendance.status.checkedOut': '퇴근',
  'attendance.status.absent': '결근',
  'common.loading': '로딩 중...',
  'common.error': '오류',
  'common.save': '저장',
  'common.cancel': '취소',
  'common.delete': '삭제',
  'common.edit': '수정',
  'common.close': '닫기',
  'common.confirm': '확인',
  'auth.signIn': '로그인',
  'auth.signOut': '로그아웃',
  'auth.email': '이메일',
  'auth.password': '비밀번호',
  'auth.forgotPassword': '비밀번호 찾기',
  'staff.name': '이름',
  'staff.role': '역할',
  'staff.phone': '전화번호',
  'staff.email': '이메일',
  'staff.time': '시간',
  'staff.workTime': '근무시간',
  'staff.editTime': '시간 수정',
  'staff.exception': '예외 처리',
  'staff.contactInfo': '연락처 정보',
  'staff.noContact': '연락처 정보가 없습니다',
  'staff.call': '통화',
  'staff.mail': '메일',
  'jobPosting.title': '제목',
  'jobPosting.description': '설명',
  'jobPosting.requirements': '요구사항',
  'jobPosting.benefits': '혜택',
  'jobPosting.location': '위치',
  'jobPosting.salary': '급여',
  'tournament.name': '토너먼트명',
  'tournament.date': '날짜',
  'tournament.time': '시간',
  'tournament.participants': '참가자',
  'tournament.status': '상태',
  // 추가 번역
  '연락처 정보': '연락처 정보',
  '스와이프 액션': '스와이프 액션',
  '←': '←',
  '액션': '액션',
  '•': '•',
  '선택': '선택',
  '→': '→'
};

export const useTranslation = () => {
  return {
    t: (key) => translations[key] || key,
    i18n: {
      changeLanguage: () => new Promise(() => {}),
      language: 'ko'
    }
  };
};

export const Trans = ({ children }) => children;

export const initReactI18next = {
  type: '3rdParty',
  init: () => {}
};