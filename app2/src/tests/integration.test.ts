/**
 * 통합 테스트
 * Person 타입 시스템과 기존 시스템의 호환성 검증
 */

import { 
  Person, 
  isStaff, 
  isApplicant, 
  getPersonId 
} from '../types/unified/person';

import {
  staffToPerson,
  applicantToPerson,
  personToLegacyStaff,
  personToLegacyApplicant,
  mapWorkLogIds,
  mapApplicationIds
} from '../utils/compatibilityAdapter';

import {
  toDateString,
  toTimeString,
  formatDateDisplay,
  toTimestamp
} from '../utils/dateUtils';

import { Timestamp } from 'firebase/firestore';

describe('Person 타입 시스템 통합 테스트', () => {
  
  describe('Person 타입 가드', () => {
    it('staff 타입을 올바르게 식별해야 함', () => {
      const staffPerson: Person = {
        id: '1',
        name: '홍길동',
        phone: '010-1234-5678',
        type: 'staff',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      expect(isStaff(staffPerson)).toBe(true);
      expect(isApplicant(staffPerson)).toBe(false);
    });
    
    it('both 타입을 staff와 applicant 모두로 식별해야 함', () => {
      const bothPerson: Person = {
        id: '2',
        name: '김철수',
        phone: '010-5678-1234',
        type: 'both',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      expect(isStaff(bothPerson)).toBe(true);
      expect(isApplicant(bothPerson)).toBe(true);
    });
  });
  
  describe('호환성 어댑터', () => {
    it('기존 staff 데이터를 Person으로 변환해야 함', () => {
      const legacyStaff = {
        id: 'staff-1',
        name: '박영희',
        phone: '010-1111-2222',
        role: '딜러',
        bankName: '국민은행',
        accountNumber: '123-456-789'
      };
      
      const person = staffToPerson(legacyStaff);
      
      expect(person.type).toBe('staff');
      expect(person.name).toBe('박영희');
      expect(person.bankName).toBe('국민은행');
    });
    
    it('Person을 레거시 staff로 역변환해야 함', () => {
      const person: Person = {
        id: 'person-1',
        name: '이순신',
        phone: '010-3333-4444',
        type: 'staff',
        role: '매니저',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      const legacyStaff = personToLegacyStaff(person);
      
      expect(legacyStaff.staffId).toBe(person.id);
      expect(legacyStaff.dealerId).toBe(person.id); // deprecated but working
      expect(legacyStaff.role).toBe('매니저');
    });
    
    it('workLog ID 매핑이 올바르게 동작해야 함', () => {
      const workLog = {
        id: 'log-1',
        staffId: 'staff-1',
        date: '2025-01-20'
      };
      
      const mapped = mapWorkLogIds(workLog);
      
      expect(mapped.personId).toBe('staff-1');
      expect(mapped.staffId).toBe('staff-1'); // 하위 호환성
      expect(mapped.dealerId).toBe('staff-1'); // deprecated
    });
  });
  
  describe('날짜 유틸리티', () => {
    it('모든 날짜 형식을 yyyy-MM-dd로 변환해야 함', () => {
      const timestamp = Timestamp.fromDate(new Date('2025-01-20'));
      const date = new Date('2025-01-20');
      const string = '2025-01-20';
      const number = date.getTime();
      
      expect(toDateString(timestamp)).toBe('2025-01-20');
      expect(toDateString(date)).toBe('2025-01-20');
      expect(toDateString(string)).toBe('2025-01-20');
      expect(toDateString(number)).toBe('2025-01-20');
    });
    
    it('시간을 HH:mm 형식으로 변환해야 함', () => {
      const date = new Date('2025-01-20T14:30:00');
      
      expect(toTimeString(date)).toMatch(/^\d{2}:\d{2}$/);
      expect(toTimeString('14:30')).toBe('14:30');
    });
    
    it('날짜를 한국어 형식으로 표시해야 함', () => {
      const result = formatDateDisplay('2025-01-20');
      
      expect(result).toContain('1월');
      expect(result).toContain('20일');
      expect(result).toMatch(/\([일월화수목금토]\)/);
    });
  });
  
  describe('ID 호환성', () => {
    it('다양한 ID 필드를 통합해야 함', () => {
      const entity1 = { staffId: 'id-1' };
      const entity2 = { applicantId: 'id-2' };
      const entity3 = { personId: 'id-3' };
      const entity4 = { id: 'id-4' };
      
      expect(getPersonId(entity1)).toBe('id-1');
      expect(getPersonId(entity2)).toBe('id-2');
      expect(getPersonId(entity3)).toBe('id-3');
      expect(getPersonId(entity4)).toBe('id-4');
    });
  });
});

describe('WorkSession 다중 세션 테스트', () => {
  // WorkSession 관련 테스트는 별도 파일로 분리 가능
  it('같은 날짜에 여러 세션 생성 가능해야 함', () => {
    // TODO: WorkSession 테스트 구현
    expect(true).toBe(true);
  });
});

// 더 많은 테스트 케이스 추가 가능