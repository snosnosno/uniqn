import { Person, Staff, Applicant, isStaff, isApplicant } from '../types/unified/person';
import { Timestamp } from 'firebase/firestore';

/**
 * 호환성 어댑터
 * 기존 staff/applicants 구조를 사용하는 코드가
 * 새로운 persons 구조와 호환되도록 지원
 */

/**
 * 기존 staff 데이터를 Person으로 변환
 */
export function staffToPerson(staff: any): Person {
  return {
    id: staff.id || staff.staffId || staff.dealerId,
    name: staff.name || staff.staffName || '',
    phone: staff.phone || staff.phoneNumber || '',
    email: staff.email,
    type: 'staff',
    
    // staff 필드들
    role: staff.role || staff.position,
    assignedTime: staff.assignedTime,
    assignedDate: staff.assignedDate,
    bankName: staff.bankName,
    accountNumber: staff.accountNumber,
    status: staff.status,
    isActive: staff.isActive ?? true,
    department: staff.department,
    position: staff.position,
    joinDate: staff.joinDate,
    
    // 메타데이터
    createdAt: staff.createdAt || Timestamp.now(),
    updatedAt: staff.updatedAt || Timestamp.now(),
    createdBy: staff.createdBy,
    updatedBy: staff.updatedBy,
    metadata: staff.metadata
  };
}

/**
 * 기존 applicant 데이터를 Person으로 변환
 */
export function applicantToPerson(applicant: any): Person {
  return {
    id: applicant.id || applicant.applicantId,
    name: applicant.name || applicant.applicantName || '',
    phone: applicant.phone || applicant.phoneNumber || '',
    email: applicant.email,
    type: 'applicant',
    
    // applicant 필드들
    availableRoles: applicant.availableRoles || applicant.roles,
    availableDates: applicant.availableDates || applicant.dates,
    availableTimes: applicant.availableTimes || applicant.times,
    applicationHistory: applicant.applicationHistory,
    applicationCount: applicant.applicationCount,
    experience: applicant.experience,
    certifications: applicant.certifications,
    skills: applicant.skills,
    
    // 메타데이터
    createdAt: applicant.createdAt || Timestamp.now(),
    updatedAt: applicant.updatedAt || Timestamp.now(),
    createdBy: applicant.createdBy,
    updatedBy: applicant.updatedBy,
    metadata: applicant.metadata
  };
}

/**
 * Person을 기존 staff 구조로 변환 (하위 호환성)
 */
export function personToLegacyStaff(person: Person): any {
  if (!isStaff(person)) {
    throw new Error('Person is not a staff member');
  }
  
  return {
    id: person.id,
    staffId: person.id,  // 하위 호환성
    dealerId: person.id,  // deprecated but working
    name: person.name,
    staffName: person.name,  // 하위 호환성
    phone: person.phone,
    phoneNumber: person.phone,  // 하위 호환성
    email: person.email,
    
    role: person.role,
    position: person.position || person.role,
    assignedTime: person.assignedTime,
    assignedDate: person.assignedDate,
    bankName: person.bankName,
    accountNumber: person.accountNumber,
    status: person.status,
    isActive: person.isActive,
    department: person.department,
    joinDate: person.joinDate,
    
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
    createdBy: person.createdBy,
    updatedBy: person.updatedBy
  };
}

/**
 * Person을 기존 applicant 구조로 변환 (하위 호환성)
 */
export function personToLegacyApplicant(person: Person): any {
  if (!isApplicant(person)) {
    throw new Error('Person is not an applicant');
  }
  
  return {
    id: person.id,
    applicantId: person.id,  // 하위 호환성
    name: person.name,
    applicantName: person.name,  // 하위 호환성
    phone: person.phone,
    phoneNumber: person.phone,  // 하위 호환성
    email: person.email,
    
    availableRoles: person.availableRoles,
    roles: person.availableRoles,  // 하위 호환성
    availableDates: person.availableDates,
    dates: person.availableDates,  // 하위 호환성
    availableTimes: person.availableTimes,
    times: person.availableTimes,  // 하위 호환성
    
    applicationHistory: person.applicationHistory,
    applicationCount: person.applicationCount,
    experience: person.experience,
    certifications: person.certifications,
    skills: person.skills,
    
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
    createdBy: person.createdBy,
    updatedBy: person.updatedBy
  };
}

/**
 * workLog에서 사용하는 staffId를 personId로 매핑
 */
export function mapWorkLogIds(workLog: any): any {
  return {
    ...workLog,
    personId: workLog.personId || workLog.staffId || workLog.dealerId,
    staffId: workLog.personId || workLog.staffId || workLog.dealerId,  // 하위 호환성
    dealerId: workLog.personId || workLog.staffId || workLog.dealerId   // deprecated
  };
}

/**
 * application에서 사용하는 applicantId를 personId로 매핑
 */
export function mapApplicationIds(application: any): any {
  return {
    ...application,
    personId: application.personId || application.applicantId,
    applicantId: application.personId || application.applicantId  // 하위 호환성
  };
}

/**
 * 쿼리 필터를 persons 컬렉션용으로 변환
 */
export function convertQueryForPersons(originalQuery: any): any {
  // staff 쿼리를 persons 쿼리로 변환
  if (originalQuery.collection === 'staff') {
    return {
      ...originalQuery,
      collection: 'persons',
      where: [
        ...(originalQuery.where || []),
        ['type', 'in', ['staff', 'both']]
      ]
    };
  }
  
  // applicants 쿼리를 persons 쿼리로 변환
  if (originalQuery.collection === 'applicants') {
    return {
      ...originalQuery,
      collection: 'persons',
      where: [
        ...(originalQuery.where || []),
        ['type', 'in', ['applicant', 'both']]
      ]
    };
  }
  
  return originalQuery;
}

/**
 * 배치 데이터 마이그레이션 헬퍼
 * 기존 staff/applicants 데이터를 persons로 일괄 변환
 */
export async function migrateToPersons(
  staffData: any[],
  applicantData: any[]
): Promise<Person[]> {
  const persons: Person[] = [];
  const phoneMap = new Map<string, Person>();
  
  // staff 데이터 처리
  for (const staff of staffData) {
    const person = staffToPerson(staff);
    const existing = phoneMap.get(person.phone);
    
    if (existing) {
      // 같은 전화번호가 있으면 'both' 타입으로 변경
      existing.type = 'both';
      // staff 필드 병합
      Object.assign(existing, {
        role: person.role || existing.role,
        bankName: person.bankName || existing.bankName,
        accountNumber: person.accountNumber || existing.accountNumber
      });
    } else {
      phoneMap.set(person.phone, person);
      persons.push(person);
    }
  }
  
  // applicant 데이터 처리
  for (const applicant of applicantData) {
    const person = applicantToPerson(applicant);
    const existing = phoneMap.get(person.phone);
    
    if (existing) {
      // 같은 전화번호가 있으면 'both' 타입으로 변경
      existing.type = 'both';
      // applicant 필드 병합
      Object.assign(existing, {
        availableRoles: person.availableRoles || existing.availableRoles,
        applicationHistory: [
          ...(existing.applicationHistory || []),
          ...(person.applicationHistory || [])
        ]
      });
    } else {
      phoneMap.set(person.phone, person);
      persons.push(person);
    }
  }
  
  return persons;
}