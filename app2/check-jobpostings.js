const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyC-VW5P98RdANCfzKJgTX7wkJPXZJ_sXlE",
  authDomain: "tholdem-ebc18.firebaseapp.com",
  projectId: "tholdem-ebc18",
  storageBucket: "tholdem-ebc18.firebasestorage.app",
  messagingSenderId: "1047482466530",
  appId: "1:1047482466530:web:b7c6e7d5b9a7a5e7c3a4c3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkJobPostings() {
  try {
    const snapshot = await getDocs(collection(db, 'jobPostings'));
    console.log(`\n총 ${snapshot.size}개의 구인공고 발견\n`);
    
    snapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`[공고 ${index + 1}] ID: ${doc.id}`);
      console.log(`  제목: ${data.title}`);
      console.log(`  createdBy: ${data.createdBy || '없음'}`);
      console.log(`  상태: ${data.status}`);
      console.log('---');
    });
  } catch (error) {
    console.error('에러:', error);
  }
}

checkJobPostings();
