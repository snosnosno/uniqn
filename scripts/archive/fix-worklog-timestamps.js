const admin = require('firebase-admin');
const serviceAccount = require('./t-holdem-firebase-adminsdk-v4p2h-17b0754402.json');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fixWorkLogTimestamps() {
  console.log('🔍 Searching for workLogs with January 21, 2025 date...');
  
  try {
    // Find workLogs with January 21, 2025 date
    const workLogsRef = db.collection('workLogs');
    const snapshot = await workLogsRef.where('date', '==', '2025-01-21').get();
    
    if (snapshot.empty) {
      console.log('No workLogs found with date 2025-01-21');
      return;
    }
    
    console.log(`Found ${snapshot.size} workLog(s) with January 21 date`);
    
    const batch = db.batch();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\nProcessing workLog: ${doc.id}`);
      console.log('Current data:', {
        date: data.date,
        staffName: data.staffName,
        role: data.role,
        scheduledStartTime: data.scheduledStartTime?.toDate?.()?.toLocaleString('ko-KR'),
        scheduledEndTime: data.scheduledEndTime?.toDate?.()?.toLocaleString('ko-KR')
      });
      
      // Check if this is the dealer entry that should have 16:00-22:00
      if (data.role === 'dealer' && data.staffName === '김승호') {
        // Create new timestamps with correct date and time
        // January 21, 2025, 16:00 (4 PM)
        const newStartTime = admin.firestore.Timestamp.fromDate(new Date(2025, 0, 21, 16, 0, 0));
        // January 21, 2025, 22:00 (10 PM)
        const newEndTime = admin.firestore.Timestamp.fromDate(new Date(2025, 0, 21, 22, 0, 0));
        
        batch.update(doc.ref, {
          scheduledStartTime: newStartTime,
          scheduledEndTime: newEndTime
        });
        
        console.log('Will update times to: 16:00-22:00');
        console.log('New timestamps:', {
          startTime: newStartTime.toDate().toLocaleString('ko-KR'),
          endTime: newEndTime.toDate().toLocaleString('ko-KR')
        });
      }
      // Check if this is the other entry (might be a duplicate or different role)
      else if (doc.id.includes('0_2025-08-21')) {
        // This seems to be another entry, let's update its timestamps too
        // Keep the original times but fix the date
        if (data.scheduledStartTime) {
          const oldStart = data.scheduledStartTime.toDate();
          const newStartTime = admin.firestore.Timestamp.fromDate(
            new Date(2025, 0, 21, oldStart.getHours(), oldStart.getMinutes(), 0)
          );
          const oldEnd = data.scheduledEndTime?.toDate();
          const newEndTime = oldEnd ? admin.firestore.Timestamp.fromDate(
            new Date(2025, 0, 21, oldEnd.getHours(), oldEnd.getMinutes(), 0)
          ) : null;
          
          const updates = {
            scheduledStartTime: newStartTime
          };
          if (newEndTime) {
            updates.scheduledEndTime = newEndTime;
          }
          
          batch.update(doc.ref, updates);
          
          console.log('Will update timestamps to January 21 with same times');
          console.log('New timestamps:', {
            startTime: newStartTime.toDate().toLocaleString('ko-KR'),
            endTime: newEndTime?.toDate()?.toLocaleString('ko-KR')
          });
        }
      }
    });
    
    // Commit the batch
    await batch.commit();
    console.log('\n✅ Successfully updated all timestamps');
    
    // Verify the changes
    console.log('\n🔍 Verifying changes...');
    const verifySnapshot = await workLogsRef.where('date', '==', '2025-01-21').get();
    
    verifySnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\nVerified workLog: ${doc.id}`);
      console.log('Updated data:', {
        date: data.date,
        staffName: data.staffName,
        role: data.role,
        scheduledStartTime: data.scheduledStartTime?.toDate?.()?.toLocaleString('ko-KR'),
        scheduledEndTime: data.scheduledEndTime?.toDate?.()?.toLocaleString('ko-KR'),
        // Also show hours for clarity
        startHour: data.scheduledStartTime?.toDate?.()?.getHours(),
        endHour: data.scheduledEndTime?.toDate?.()?.getHours()
      });
    });
    
  } catch (error) {
    console.error('Error fixing timestamps:', error);
  } finally {
    process.exit();
  }
}

// Run the fix
fixWorkLogTimestamps();