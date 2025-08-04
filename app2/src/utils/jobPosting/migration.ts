import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { logger } from '../logger';
import { JobPosting } from '../../types/jobPosting';

/**
 * 기존 구인공고 데이터를 새로운 구조로 마이그레이션
 * timeSlots를 사용하는 구공고를 dateSpecificRequirements로 변환
 */
export const migrateJobPostingsToDateSpecific = async (): Promise<void> => {
  logger.debug('🔄 구인공고 데이터 마이그레이션 시작...', { component: 'migration' });
  
  try {
    const jobPostingsRef = collection(db, 'jobPostings');
    const snapshot = await getDocs(jobPostingsRef);
    
    let migrationCount = 0;
    let errorCount = 0;
    
    for (const docSnapshot of snapshot.docs) {
      try {
        const data = docSnapshot.data();
        const jobId = docSnapshot.id;
        
        // 이미 dateSpecificRequirements가 있으면 건너뛰기
        if (data.dateSpecificRequirements && Array.isArray(data.dateSpecificRequirements) && data.dateSpecificRequirements.length > 0) {
          logger.debug(`✅ ${jobId}: 이미 마이그레이션됨`, { component: 'migration' });
          continue;
        }
        
        // timeSlots가 있고 dateSpecificRequirements가 없는 경우 마이그레이션
        if (data.timeSlots && Array.isArray(data.timeSlots) && data.timeSlots.length > 0) {
          logger.debug(`🔧 ${jobId}: 마이그레이션 필요`, { component: 'migration' });
          
          // 시작일과 종료일 사이의 모든 날짜에 동일한 timeSlots 적용
          const startDate = data.startDate?.toDate ? data.startDate.toDate() : new Date(data.startDate);
          const endDate = data.endDate?.toDate ? data.endDate.toDate() : new Date(data.endDate);
          
          const dateSpecificRequirements = [];
          const currentDate = new Date(startDate);
          
          while (currentDate <= endDate) {
            dateSpecificRequirements.push({
              date: currentDate.toISOString().split('T')[0],
              timeSlots: data.timeSlots
            });
            
            // 다음 날로 이동
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          // 업데이트
          const docRef = doc(db, 'jobPostings', jobId);
          await updateDoc(docRef, {
            dateSpecificRequirements,
            // timeSlots와 usesDifferentDailyRequirements는 제거하지 않음 (호환성 유지)
            updatedAt: new Date()
          });
          
          migrationCount++;
          logger.debug(`✅ ${jobId}: 마이그레이션 완료`, { component: 'migration' });
        }
      } catch (error) {
        errorCount++;
        logger.error(`❌ 문서 마이그레이션 실패 (${docSnapshot.id}):`, error instanceof Error ? error : new Error(String(error)), { 
          component: 'migration'
        });
      }
    }
    
    logger.debug(`🎉 마이그레이션 완료: ${migrationCount}개 성공, ${errorCount}개 실패`, { component: 'migration' });
    
  } catch (error) {
    logger.error('마이그레이션 중 오류 발생:', error instanceof Error ? error : new Error(String(error)), { component: 'migration' });
    throw error;
  }
};

/**
 * 기존 데이터 호환성 체크
 * dateSpecificRequirements가 없는 문서 확인
 */
export const checkDataCompatibility = async (): Promise<{
  total: number;
  needsMigration: number;
  alreadyMigrated: number;
  documents: Array<{ id: string; title: string; hasTimeSlots: boolean; hasDateSpecific: boolean }>
}> => {
  logger.debug('🔍 데이터 호환성 체크 시작...', { component: 'migration' });
  
  try {
    const jobPostingsRef = collection(db, 'jobPostings');
    const snapshot = await getDocs(jobPostingsRef);
    
    let needsMigration = 0;
    let alreadyMigrated = 0;
    const documents: Array<{ id: string; title: string; hasTimeSlots: boolean; hasDateSpecific: boolean }> = [];
    
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const hasTimeSlots = !!(data.timeSlots && Array.isArray(data.timeSlots) && data.timeSlots.length > 0);
      const hasDateSpecific = !!(data.dateSpecificRequirements && Array.isArray(data.dateSpecificRequirements) && data.dateSpecificRequirements.length > 0);
      
      documents.push({
        id: docSnapshot.id,
        title: data.title || 'Unknown',
        hasTimeSlots,
        hasDateSpecific
      });
      
      if (!hasDateSpecific && hasTimeSlots) {
        needsMigration++;
      } else if (hasDateSpecific) {
        alreadyMigrated++;
      }
    });
    
    const result = {
      total: snapshot.size,
      needsMigration,
      alreadyMigrated,
      documents
    };
    
    logger.debug('📊 호환성 체크 결과:', { component: 'migration', data: result });
    
    return result;
  } catch (error) {
    logger.error('호환성 체크 중 오류 발생:', error instanceof Error ? error : new Error(String(error)), { component: 'migration' });
    throw error;
  }
};