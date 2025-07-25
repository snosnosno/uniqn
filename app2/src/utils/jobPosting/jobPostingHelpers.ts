import { RoleRequirement, TimeSlot, DateSpecificRequirement, JobPostingTemplate } from '../../types/jobPosting';
import { convertToTimestamp, getTodayString } from './dateUtils';

/**
 * 초기 시간대 객체 생성
 */
export const createInitialTimeSlot = (): TimeSlot => ({
  time: '09:00',
  roles: [{ name: 'dealer', count: 1 }],
  isTimeToBeAnnounced: false,
  tentativeDescription: ''
});

/**
 * 초기 폼 데이터 생성
 */
export const createInitialFormData = () => ({
  title: '',
  type: 'application' as const,
  timeSlots: [createInitialTimeSlot()],
  dateSpecificRequirements: [] as DateSpecificRequirement[],
  usesDifferentDailyRequirements: false,
  description: '',
  status: 'open' as const,
  location: '서울',
  detailedAddress: '',
  preQuestions: [] as any[],
  usesPreQuestions: false,
  startDate: getTodayString(),
  endDate: getTodayString(),
});

/**
 * 새로운 역할 추가
 */
export const createNewRole = (): RoleRequirement => ({
  name: 'dealer',
  count: 1
});

/**
 * 새로운 사전질문 생성
 */
export const createNewPreQuestion = () => ({
  id: Date.now().toString(),
  question: '',
  required: true,
  type: 'text' as const,
  options: []
});

/**
 * 새로운 일자별 요구사항 생성
 */
export const createNewDateSpecificRequirement = (date: string): DateSpecificRequirement => ({
  date,
  timeSlots: [createInitialTimeSlot()]
});

/**
 * 템플릿에서 폼 데이터로 변환
 */
export const templateToFormData = (template: JobPostingTemplate) => {
  return {
    ...template.templateData,
    startDate: getTodayString(),
    endDate: getTodayString(),
    status: 'open' as const, // 템플릿에서 불러온 공고는 항상 open 상태로 설정
  };
};

/**
 * 폼 데이터를 Firebase 저장용으로 변환
 */
export const prepareFormDataForFirebase = (formData: any) => {
  console.log('🔍 prepareFormDataForFirebase 입력 데이터:', formData);
  
  // 모든 역할을 수집하여 requiredRoles 배열 생성
  const requiredRoles = new Set<string>();
  
  if (formData.usesDifferentDailyRequirements && formData.dateSpecificRequirements) {
    console.log('📅 일자별 다른 요구사항 처리 중...');
    formData.dateSpecificRequirements.forEach((req: DateSpecificRequirement) => {
      req.timeSlots.forEach((timeSlot: TimeSlot) => {
        timeSlot.roles.forEach((role: RoleRequirement) => {
          if (role.name) {
            requiredRoles.add(role.name);
            console.log('👤 역할 추가:', role.name);
          }
        });
      });
    });
  } else if (formData.timeSlots) {
    console.log('⏰ 일반 시간대 처리 중...');
    formData.timeSlots.forEach((timeSlot: TimeSlot) => {
      timeSlot.roles.forEach((role: RoleRequirement) => {
        if (role.name) {
          requiredRoles.add(role.name);
          console.log('👤 역할 추가:', role.name);
        }
      });
    });
  }

  const requiredRolesArray = Array.from(requiredRoles);
  console.log('✅ 최종 requiredRoles:', requiredRolesArray);

  const result = {
    ...formData,
    startDate: convertToTimestamp(formData.startDate),
    endDate: convertToTimestamp(formData.endDate),
    createdAt: convertToTimestamp(new Date()),
    updatedAt: convertToTimestamp(new Date()),
    requiredRoles: requiredRolesArray, // 검색을 위한 역할 배열 추가
    dateSpecificRequirements: formData.dateSpecificRequirements?.map((req: DateSpecificRequirement) => ({
      ...req,
      date: convertToTimestamp(req.date)
    })) || []
  };

  console.log('🚀 Firebase 저장용 최종 데이터:', result);
  return result;
};

/**
 * Firebase 데이터를 폼 데이터로 변환
 */
export const prepareFirebaseDataForForm = (data: any) => {
  return {
    ...data,
    startDate: data.startDate?.toDate?.() || data.startDate,
    endDate: data.endDate?.toDate?.() || data.endDate,
    dateSpecificRequirements: (data.dateSpecificRequirements || []).map((req: any) => ({
      ...req,
      date: req.date?.toDate?.() || req.date
    }))
  };
};

/**
 * 미리 정의된 역할 목록
 */
export const PREDEFINED_ROLES = [
  'dealer',              // 딜러
  'floor',               // 플로어  
  'serving',             // 서빙
  'tournament_director', // 토너먼트 디렉터
  'chip_master',         // 칩 마스터
  'registration',        // 레지스트레이션
  'security',            // 보안요원
  'cashier'              // 캐셔
];

/**
 * 지역 목록
 */
export const LOCATIONS = [
  '서울', '경기', '인천', '강원', '대전', '세종', '충남', '충북', 
  '광주', '전남', '전북', '대구', '경북', '부산', '울산', '경남', '제주', '해외', '기타'
];

/**
 * 역할 이름을 한국어로 변환
 */
export const getRoleDisplayName = (roleName: string): string => {
  const roleMap: Record<string, string> = {
    dealer: '딜러',
    floor: '플로어',
    serving: '서빙',
    tournament_director: '토너먼트 디렉터',
    chip_master: '칩 마스터',
    registration: '레지스트레이션',
    security: '보안요원',
    cashier: '캐셔'
  };
  
  return roleMap[roleName] || roleName;
};

/**
 * 공고 상태를 한국어로 변환
 */
export const getStatusDisplayName = (status: string): string => {
  const statusMap: Record<string, string> = {
    open: '모집중',
    closed: '마감',
    draft: '임시저장'
  };
  
  return statusMap[status] || status;
};

/**
 * 공고 타입을 한국어로 변환
 */
export const getTypeDisplayName = (type: string): string => {
  const typeMap: Record<string, string> = {
    application: '지원',
    fixed: '고정'
  };
  
  return typeMap[type] || type;
};

/**
 * 시간대 문자열 생성 (역할과 인원 포함)
 */
export const generateTimeSlotSummary = (timeSlot: TimeSlot): string => {
  if (timeSlot.isTimeToBeAnnounced) {
    return '추후공지';
  }
  
  const rolesSummary = timeSlot.roles
    .map(role => `${getRoleDisplayName(role.name)} ${role.count}명`)
    .join(', ');
    
  return `${timeSlot.time} (${rolesSummary})`;
};

/**
 * 총 모집 인원 계산
 */
export const calculateTotalPositions = (timeSlots: TimeSlot[]): number => {
  return timeSlots.reduce((total, timeSlot) => {
    return total + timeSlot.roles.reduce((roleTotal, role) => roleTotal + role.count, 0);
  }, 0);
};

/**
 * 일자별 요구사항에서 총 모집 인원 계산
 */
export const calculateTotalPositionsFromDateRequirements = (requirements: DateSpecificRequirement[]): number => {
  return requirements.reduce((total, requirement) => {
    return total + calculateTotalPositions(requirement.timeSlots);
  }, 0);
};