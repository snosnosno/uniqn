import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  writeBatch,
  query,
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Person, PersonCreateInput } from '../types/unified/person';
import { 
  staffToPerson, 
  applicantToPerson, 
  migrateToPersons 
} from '../utils/compatibilityAdapter';
import { logger } from '../utils/logger';

/**
 * Person 마이그레이션 서비스
 * staff와 applicants 데이터를 persons 컬렉션으로 통합
 */
export class PersonMigrationService {
  /**
   * 마이그레이션 상태 확인
   */
  static async checkMigrationStatus(): Promise<{
    isCompleted: boolean;
    staffCount: number;
    applicantCount: number;
    personCount: number;
  }> {
    try {
      const [staffDocs, applicantDocs, personDocs] = await Promise.all([
        getDocs(collection(db, 'staff')),
        getDocs(collection(db, 'applicants')),
        getDocs(collection(db, 'persons'))
      ]);

      return {
        isCompleted: personDocs.size > 0 && 
                    (staffDocs.size === 0 || applicantDocs.size === 0),
        staffCount: staffDocs.size,
        applicantCount: applicantDocs.size,
        personCount: personDocs.size
      };
    } catch (error) {
      logger.error('마이그레이션 상태 확인 실패', error as Error, {
        component: 'PersonMigrationService'
      });
      throw error;
    }
  }

  /**
   * 데이터 백업 (안전장치)
   */
  static async backupData(): Promise<void> {
    try {
      logger.info('데이터 백업 시작', { component: 'PersonMigrationService' });
      
      const [staffDocs, applicantDocs] = await Promise.all([
        getDocs(collection(db, 'staff')),
        getDocs(collection(db, 'applicants'))
      ]);

      const batch = writeBatch(db);
      const backupDate = new Date().toISOString().split('T')[0];

      // staff 백업
      staffDocs.forEach(docSnapshot => {
        const backupRef = doc(collection(db, `staff_backup_${backupDate}`), docSnapshot.id);
        const cleanedData = this.removeUndefinedFields(docSnapshot.data());
        batch.set(backupRef, cleanedData);
      });

      // applicants 백업
      applicantDocs.forEach(docSnapshot => {
        const backupRef = doc(collection(db, `applicants_backup_${backupDate}`), docSnapshot.id);
        const cleanedData = this.removeUndefinedFields(docSnapshot.data());
        batch.set(backupRef, cleanedData);
      });

      await batch.commit();
      
      logger.info('데이터 백업 완료', { 
        component: 'PersonMigrationService',
        data: {
          staffBackup: staffDocs.size,
          applicantBackup: applicantDocs.size
        }
      });
    } catch (error) {
      logger.error('데이터 백업 실패', error as Error, {
        component: 'PersonMigrationService'
      });
      throw error;
    }
  }

  /**
   * undefined 값을 제거하는 헬퍼 함수
   */
  private static removeUndefinedFields(obj: any): any {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        if (obj[key] && typeof obj[key] === 'object' && !(obj[key] instanceof Date) && !(obj[key] instanceof Timestamp)) {
          // 중첩된 객체의 경우 재귀적으로 처리
          cleaned[key] = this.removeUndefinedFields(obj[key]);
        } else {
          cleaned[key] = obj[key];
        }
      }
    }
    return cleaned;
  }

  /**
   * 실제 마이그레이션 실행
   */
  static async migrate(options: {
    dryRun?: boolean;
    backup?: boolean;
  } = {}): Promise<{
    success: boolean;
    personsCreated: number;
    duplicatesFound: number;
    errors: string[];
  }> {
    const { dryRun = false, backup = true } = options;
    const errors: string[] = [];
    
    try {
      logger.info('마이그레이션 시작', { 
        component: 'PersonMigrationService',
        data: { dryRun, backup }
      });

      // 1. 백업 실행 (옵션)
      if (backup && !dryRun) {
        await this.backupData();
      }

      // 2. 기존 데이터 로드
      const [staffDocs, applicantDocs] = await Promise.all([
        getDocs(collection(db, 'staff')),
        getDocs(collection(db, 'applicants'))
      ]);

      const staffData = staffDocs.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const applicantData = applicantDocs.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 3. Person 데이터로 변환
      const persons = await migrateToPersons(staffData, applicantData);
      
      // 4. 중복 체크
      const phoneMap = new Map<string, Person[]>();
      let duplicatesFound = 0;

      persons.forEach(person => {
        const existing = phoneMap.get(person.phone) || [];
        if (existing.length > 0) {
          duplicatesFound++;
        }
        phoneMap.set(person.phone, [...existing, person]);
      });

      // 5. persons 컬렉션에 저장
      if (!dryRun) {
        const batch = writeBatch(db);
        let batchCount = 0;
        
        for (const person of persons) {
          const personRef = doc(collection(db, 'persons'), person.id);
          // undefined 필드 제거
          const cleanedPerson = this.removeUndefinedFields({
            ...person,
            createdAt: person.createdAt || Timestamp.now(),
            updatedAt: Timestamp.now(),
            migrated: true,
            migratedAt: Timestamp.now()
          });
          batch.set(personRef, cleanedPerson);
          
          batchCount++;
          
          // Firestore batch 제한 (500개)
          if (batchCount === 500) {
            await batch.commit();
            batchCount = 0;
          }
        }
        
        if (batchCount > 0) {
          await batch.commit();
        }
      }

      logger.info('마이그레이션 완료', { 
        component: 'PersonMigrationService',
        data: {
          personsCreated: persons.length,
          duplicatesFound,
          dryRun
        }
      });

      return {
        success: true,
        personsCreated: persons.length,
        duplicatesFound,
        errors
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      
      logger.error('마이그레이션 실패', error as Error, {
        component: 'PersonMigrationService'
      });

      return {
        success: false,
        personsCreated: 0,
        duplicatesFound: 0,
        errors
      };
    }
  }

  /**
   * 참조 업데이트 (workLogs, applications 등)
   */
  static async updateReferences(): Promise<{
    workLogsUpdated: number;
    applicationsUpdated: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let workLogsUpdated = 0;
    let applicationsUpdated = 0;

    try {
      logger.info('참조 업데이트 시작', { component: 'PersonMigrationService' });

      // 1. workLogs의 staffId를 personId로 업데이트
      const workLogs = await getDocs(collection(db, 'workLogs'));
      const workLogBatch = writeBatch(db);
      
      workLogs.forEach(doc => {
        const data = doc.data();
        if (data.staffId && !data.personId) {
          workLogBatch.update(doc.ref, {
            personId: data.staffId,
            updatedAt: Timestamp.now()
          });
          workLogsUpdated++;
        }
      });

      if (workLogsUpdated > 0) {
        await workLogBatch.commit();
      }

      // 2. applications의 applicantId를 personId로 업데이트
      const applications = await getDocs(collection(db, 'applications'));
      const appBatch = writeBatch(db);
      
      applications.forEach(doc => {
        const data = doc.data();
        if (data.applicantId && !data.personId) {
          appBatch.update(doc.ref, {
            personId: data.applicantId,
            updatedAt: Timestamp.now()
          });
          applicationsUpdated++;
        }
      });

      if (applicationsUpdated > 0) {
        await appBatch.commit();
      }

      logger.info('참조 업데이트 완료', { 
        component: 'PersonMigrationService',
        data: {
          workLogsUpdated,
          applicationsUpdated
        }
      });

      return {
        workLogsUpdated,
        applicationsUpdated,
        errors
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      
      logger.error('참조 업데이트 실패', error as Error, {
        component: 'PersonMigrationService'
      });

      return {
        workLogsUpdated,
        applicationsUpdated,
        errors
      };
    }
  }

  /**
   * 롤백 (비상시)
   */
  static async rollback(backupDate: string): Promise<boolean> {
    try {
      logger.warn('롤백 시작', { 
        component: 'PersonMigrationService',
        data: { backupDate }
      });

      // 1. persons 컬렉션 삭제
      const persons = await getDocs(collection(db, 'persons'));
      const deleteBatch = writeBatch(db);
      
      persons.forEach(doc => {
        deleteBatch.delete(doc.ref);
      });
      
      await deleteBatch.commit();

      // 2. 백업에서 복원
      const [staffBackup, applicantBackup] = await Promise.all([
        getDocs(collection(db, `staff_backup_${backupDate}`)),
        getDocs(collection(db, `applicants_backup_${backupDate}`))
      ]);

      const restoreBatch = writeBatch(db);
      
      staffBackup.forEach(docSnapshot => {
        const staffRef = doc(collection(db, 'staff'), docSnapshot.id);
        restoreBatch.set(staffRef, docSnapshot.data());
      });
      
      applicantBackup.forEach(docSnapshot => {
        const applicantRef = doc(collection(db, 'applicants'), docSnapshot.id);
        restoreBatch.set(applicantRef, docSnapshot.data());
      });
      
      await restoreBatch.commit();

      logger.info('롤백 완료', { 
        component: 'PersonMigrationService',
        data: {
          staffRestored: staffBackup.size,
          applicantRestored: applicantBackup.size
        }
      });

      return true;

    } catch (error) {
      logger.error('롤백 실패', error as Error, {
        component: 'PersonMigrationService'
      });
      return false;
    }
  }
}