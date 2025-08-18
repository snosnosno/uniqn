import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { Person, isStaff, isApplicant } from '../types/unified/person';
import { personToLegacyStaff, personToLegacyApplicant } from '../utils/compatibilityAdapter';
import { logger } from '../utils/logger';

/**
 * Person 데이터를 관리하는 통합 Hook
 * staff와 applicants를 통합된 방식으로 조회/수정
 */
export function usePersons(filter?: {
  type?: 'staff' | 'applicant' | 'both' | 'all';
  isActive?: boolean;
}) {
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    let unsubscribe: (() => void) | undefined;

    try {
      // 쿼리 구성
      let q = query(collection(db, 'persons'));

      // 타입 필터
      if (filter?.type && filter.type !== 'all') {
        if (filter.type === 'staff') {
          q = query(q, where('type', 'in', ['staff', 'both']));
        } else if (filter.type === 'applicant') {
          q = query(q, where('type', 'in', ['applicant', 'both']));
        } else {
          q = query(q, where('type', '==', filter.type));
        }
      }

      // 활성 상태 필터
      if (filter?.isActive !== undefined) {
        q = query(q, where('isActive', '==', filter.isActive));
      }

      // 정렬
      q = query(q, orderBy('name'));

      // 실시간 구독
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Person));

          setPersons(data);
          setLoading(false);

          logger.debug('Persons 데이터 로드', {
            component: 'usePersons',
            data: {
              count: data.length,
              filter
            }
          });
        },
        (err) => {
          logger.error('Persons 조회 실패', err, {
            component: 'usePersons'
          });
          setError(err.message);
          setLoading(false);
        }
      );
    } catch (err) {
      logger.error('쿼리 생성 실패', err as Error, {
        component: 'usePersons'
      });
      setError((err as Error).message);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [filter?.type, filter?.isActive]);

  /**
   * Person 업데이트
   */
  const updatePerson = async (personId: string, updates: Partial<Person>) => {
    try {
      const personRef = doc(db, 'persons', personId);
      await updateDoc(personRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });

      logger.info('Person 업데이트 성공', {
        component: 'usePersons',
        data: { personId, updates }
      });
    } catch (err) {
      logger.error('Person 업데이트 실패', err as Error, {
        component: 'usePersons',
        data: { personId }
      });
      throw err;
    }
  };

  /**
   * 레거시 형식으로 변환 (하위 호환성)
   */
  const getAsStaff = () => {
    return persons
      .filter(isStaff)
      .map(personToLegacyStaff);
  };

  const getAsApplicants = () => {
    return persons
      .filter(isApplicant)
      .map(personToLegacyApplicant);
  };

  return {
    persons,
    loading,
    error,
    updatePerson,
    // 하위 호환성
    staff: getAsStaff(),
    applicants: getAsApplicants()
  };
}

/**
 * 특정 Person 조회
 */
export function usePerson(personId: string | undefined) {
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personId) {
      setPerson(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const personRef = doc(db, 'persons', personId);
    
    const unsubscribe = onSnapshot(
      personRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setPerson({
            id: snapshot.id,
            ...snapshot.data()
          } as Person);
        } else {
          setPerson(null);
        }
        setLoading(false);
      },
      (err) => {
        logger.error('Person 조회 실패', err, {
          component: 'usePerson',
          data: { personId }
        });
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [personId]);

  return {
    person,
    loading,
    error,
    // 하위 호환성
    asStaff: person && isStaff(person) ? personToLegacyStaff(person) : null,
    asApplicant: person && isApplicant(person) ? personToLegacyApplicant(person) : null
  };
}

/**
 * 전화번호로 Person 찾기 (중복 체크용)
 */
export function usePersonByPhone(phone: string | undefined) {
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!phone) {
      setPerson(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, 'persons'),
      where('phone', '==', phone)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          if (doc) {
            setPerson({
              id: doc.id,
              ...doc.data()
            } as Person);
          } else {
            setPerson(null);
          }
        } else {
          setPerson(null);
        }
        setLoading(false);
      },
      (err) => {
        logger.error('전화번호로 Person 조회 실패', err, {
          component: 'usePersonByPhone',
          data: { phone }
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [phone]);

  return {
    person,
    loading,
    exists: person !== null
  };
}