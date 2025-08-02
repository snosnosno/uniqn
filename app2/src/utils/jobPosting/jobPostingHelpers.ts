import { RoleRequirement, TimeSlot, DateSpecificRequirement, JobPostingTemplate, JobPostingFormData, JobPosting, Benefits } from '../../types/jobPosting';
import { logger } from '../logger';
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
export const createInitialFormData = () => {
  const today = getTodayString();
  
  return {
    title: '',
    type: 'application' as const,
    timeSlots: [createInitialTimeSlot()],
    dateSpecificRequirements: [createNewDateSpecificRequirement(today)],
    usesDifferentDailyRequirements: true,
    description: '',
    status: 'open' as const,
    location: '서울',
    detailedAddress: '',
    district: '',
    preQuestions: [] as any[],
    usesPreQuestions: false,
    startDate: today,
    endDate: today,
    salaryType: undefined,
    salaryAmount: '',
    benefits: {}
  };
};

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
    // 새로운 필드들도 템플릿에서 가져오기
    district: template.templateData.district || '',
    salaryType: template.templateData.salaryType,
    salaryAmount: template.templateData.salaryAmount || '',
    benefits: template.templateData.benefits || {}
  };
};

/**
 * 폼 데이터를 Firebase 저장용으로 변환
 */
export const prepareFormDataForFirebase = (formData: JobPostingFormData) => {
  logger.debug('🔍 prepareFormDataForFirebase 입력 데이터:', { component: 'jobPostingHelpers', data: formData });
  
  // 모든 역할을 수집하여 requiredRoles 배열 생성
  const requiredRoles = new Set<string>();
  
  if (formData.usesDifferentDailyRequirements && formData.dateSpecificRequirements) {
    logger.debug('📅 일자별 다른 요구사항 처리 중...', { component: 'jobPostingHelpers' });
    formData.dateSpecificRequirements.forEach((req: DateSpecificRequirement) => {
      req.timeSlots.forEach((timeSlot: TimeSlot) => {
        timeSlot.roles.forEach((role: RoleRequirement) => {
          if (role.name) {
            requiredRoles.add(role.name);
            logger.debug('👤 역할 추가:', { component: 'jobPostingHelpers', data: role.name });
          }
        });
      });
    });
  } else if (formData.timeSlots) {
    logger.debug('⏰ 일반 시간대 처리 중...', { component: 'jobPostingHelpers' });
    formData.timeSlots.forEach((timeSlot: TimeSlot) => {
      timeSlot.roles.forEach((role: RoleRequirement) => {
        if (role.name) {
          requiredRoles.add(role.name);
          logger.debug('👤 역할 추가:', { component: 'jobPostingHelpers', data: role.name });
        }
      });
    });
  }

  const requiredRolesArray = Array.from(requiredRoles);
  logger.debug('✅ 최종 requiredRoles:', { component: 'jobPostingHelpers', data: requiredRolesArray });

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
    })) || [],
    // 새로운 필드들 추가 (undefined 값은 Firebase에 저장되지 않음)
    ...(formData.district && { district: formData.district }),
    ...(formData.salaryType && { salaryType: formData.salaryType }),
    ...(formData.salaryAmount && { salaryAmount: formData.salaryAmount }),
    ...(formData.benefits && Object.keys(formData.benefits).length > 0 && { benefits: formData.benefits })
  };

  logger.debug('🚀 Firebase 저장용 최종 데이터:', { component: 'jobPostingHelpers', data: result });
  return result;
};

/**
 * Firebase 데이터를 폼 데이터로 변환
 */
export const prepareFirebaseDataForForm = (data: Partial<JobPosting>): JobPostingFormData => {
  const convertDate = (dateValue: any): string => {
    if (!dateValue) return '';
    if (typeof dateValue === 'string') return dateValue;
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
      const date = dateValue.toDate();
      return date.toISOString().split('T')[0] || '';
    }
    if (dateValue instanceof Date) {
      return dateValue.toISOString().split('T')[0] || '';
    }
    return '';
  };

  return {
    title: data.title || '',
    type: data.type || 'application',
    description: data.description || '',
    location: data.location || '',
    detailedAddress: data.detailedAddress,
    district: data.district,
    startDate: convertDate(data.startDate),
    endDate: convertDate(data.endDate),
    status: data.status || 'open',
    usesDifferentDailyRequirements: data.usesDifferentDailyRequirements,
    timeSlots: data.timeSlots,
    dateSpecificRequirements: (data.dateSpecificRequirements || []).map((req: DateSpecificRequirement) => ({
      ...req,
      date: convertDate(req.date)
    })),
    preQuestions: data.preQuestions,
    requiredRoles: data.requiredRoles,
    salaryType: data.salaryType,
    salaryAmount: data.salaryAmount,
    benefits: data.benefits
  } as JobPostingFormData;
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
    return '미정';
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

/**
 * 급여 타입을 한국어로 변환
 */
export const getSalaryTypeDisplayName = (type: string): string => {
  const typeMap: Record<string, string> = {
    hourly: '시급',
    daily: '일급',
    monthly: '월급',
    other: '기타'
  };
  
  return typeMap[type] || type;
};

/**
 * 급여 정보를 포맷팅하여 표시
 */
export const formatSalaryDisplay = (salaryType?: string, salaryAmount?: string): string => {
  if (!salaryType || !salaryAmount) return '';
  
  const typeName = getSalaryTypeDisplayName(salaryType);
  
  if (salaryType === 'other') {
    return `${typeName}: ${salaryAmount}`;
  }
  
  // 숫자에 천 단위 콤마 추가
  const formattedAmount = salaryAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${typeName} ${formattedAmount}원`;
};

/**
 * 복리후생 정보를 한국어로 변환하여 배열로 반환
 */
export const getBenefitDisplayNames = (benefits?: Benefits | Record<string, string>): string[] => {
  if (!benefits) return [];
  
  const benefitMap: Record<string, string> = {
    guaranteedHours: '보장',
    clothing: '복장',
    meal: '식사',
    transportation: '교통비',
    mealAllowance: '식비',
    accommodation: '숙소'
  };
  
  // 정해진 순서대로 정렬
  const benefitOrder = ['guaranteedHours', 'clothing', 'meal', 'transportation', 'mealAllowance', 'accommodation'];
  
  const sortedBenefits = benefitOrder
    .filter(key => key in benefits && benefits[key as keyof typeof benefits])
    .map(key => `${benefitMap[key]}: ${benefits[key as keyof typeof benefits]}`);
  
  return sortedBenefits;
};

/**
 * 복리후생 정보를 2개씩 그룹화하여 반환
 */
export const getBenefitDisplayGroups = (benefits?: Benefits | Record<string, string>): string[][] => {
  const benefitNames = getBenefitDisplayNames(benefits);
  const groups: string[][] = [];
  
  for (let i = 0; i < benefitNames.length; i += 2) {
    groups.push(benefitNames.slice(i, i + 2));
  }
  
  return groups;
};