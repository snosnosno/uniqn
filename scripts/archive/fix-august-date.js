const admin = require('firebase-admin');
const serviceAccount = require('./t-holdem-firebase-adminsdk-v4p2h-17b0754402.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixAugustDate() {
  console.log('🔍 Searching for workLogs with August 2025 date...');
  
  try {
    // Find workLogs with the incorrect date
    const workLogsRef = db.collection('workLogs');
    const snapshot = await workLogsRef.where('date', '==', '2025-08-21').get();
    
    if (snapshot.empty) {
      console.log('No workLogs found with date 2025-08-21');
      return;
    }
    
    console.log(`Found ${snapshot.size} workLog(s) with August date`);
    
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
      
      // Update the date to January 21, 2025
      batch.update(doc.ref, {
        date: '2025-01-21'
      });
      
      console.log('Will update date to: 2025-01-21');
    });
    
    // Commit the batch
    await batch.commit();
    console.log('\n✅ Successfully updated all August dates to January dates');
    
    // Verify the changes
    console.log('\n🔍 Verifying changes...');
    const verifySnapshot = await workLogsRef.where('date', '==', '2025-01-21').get();
    console.log(`Found ${verifySnapshot.size} workLog(s) with January date`);
    
    verifySnapshot.forEach(doc => {
      const data = doc.data();
      if (doc.id.includes('2025-08-21')) {
        console.log(`\nVerified workLog: ${doc.id}`);
        console.log('Updated data:', {
          date: data.date,
          staffName: data.staffName,
          role: data.role,
          scheduledStartTime: data.scheduledStartTime?.toDate?.()?.toLocaleString('ko-KR'),
          scheduledEndTime: data.scheduledEndTime?.toDate?.()?.toLocaleString('ko-KR')
        });
      }
    });
    
  } catch (error) {
    console.error('Error fixing August date:', error);
  } finally {
    process.exit();
  }
}

// Run the fix
fixAugustDate();