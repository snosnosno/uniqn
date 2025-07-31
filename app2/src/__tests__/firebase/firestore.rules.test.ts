import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

let testEnv: RulesTestEnvironment;

describe('Firestore Security Rules', () => {
  beforeAll(async () => {
    // 실제 rules 파일 읽기
    const rules = readFileSync('../../../firestore.rules', 'utf8');
    
    testEnv = await initializeTestEnvironment({
      projectId: 'test-project',
      firestore: {
        rules,
        host: 'localhost',
        port: 8080,
      },
    });
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  describe('Users Collection', () => {
    test('사용자는 자신의 프로필을 읽을 수 있어야 함', async () => {
      const userId = 'user1';
      const db = testEnv.authenticatedContext(userId, { role: 'staff' }).firestore();
      
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'users', userId), {
          name: 'Test User',
          email: 'test@example.com',
        });
      });

      await assertSucceeds(getDoc(doc(db, 'users', userId)));
    });

    test('사용자는 다른 사용자의 프로필을 읽을 수 없어야 함', async () => {
      const userId = 'user1';
      const otherUserId = 'user2';
      const db = testEnv.authenticatedContext(userId, { role: 'staff' }).firestore();
      
      await assertFails(getDoc(doc(db, 'users', otherUserId)));
    });

    test('관리자는 모든 사용자 프로필을 읽을 수 있어야 함', async () => {
      const adminId = 'admin1';
      const userId = 'user1';
      const db = testEnv.authenticatedContext(adminId, { role: 'admin' }).firestore();
      
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'users', userId), {
          name: 'Test User',
          email: 'test@example.com',
        });
      });

      await assertSucceeds(getDoc(doc(db, 'users', userId)));
    });
  });

  describe('Job Postings Collection', () => {
    test('인증된 사용자는 공고를 읽을 수 있어야 함', async () => {
      const userId = 'user1';
      const postId = 'post1';
      const db = testEnv.authenticatedContext(userId, { role: 'staff' }).firestore();
      
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'jobPostings', postId), {
          title: 'Test Posting',
          description: 'Test Description',
          location: 'Seoul',
          status: 'open',
          createdBy: 'someone',
          createdAt: new Date(),
        });
      });

      await assertSucceeds(getDoc(doc(db, 'jobPostings', postId)));
    });

    test('스태프는 자신의 공고를 생성할 수 있어야 함', async () => {
      const userId = 'user1';
      const postId = 'post1';
      const db = testEnv.authenticatedContext(userId, { role: 'staff' }).firestore();
      
      await assertSucceeds(
        setDoc(doc(db, 'jobPostings', postId), {
          title: 'New Posting',
          description: 'Description',
          location: 'Seoul',
          status: 'open',
          createdBy: userId,
        })
      );
    });

    test('필수 필드가 없으면 공고 생성이 실패해야 함', async () => {
      const userId = 'user1';
      const postId = 'post1';
      const db = testEnv.authenticatedContext(userId, { role: 'staff' }).firestore();
      
      await assertFails(
        setDoc(doc(db, 'jobPostings', postId), {
          title: 'New Posting',
          // description 누락
          location: 'Seoul',
          status: 'open',
          createdBy: userId,
        })
      );
    });

    test('스태프는 자신의 공고를 수정할 수 있어야 함', async () => {
      const userId = 'user1';
      const postId = 'post1';
      const db = testEnv.authenticatedContext(userId, { role: 'staff' }).firestore();
      
      // 먼저 공고 생성
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'jobPostings', postId), {
          title: 'Original Title',
          description: 'Description',
          location: 'Seoul',
          status: 'open',
          createdBy: userId,
        });
      });

      // 수정 시도
      await assertSucceeds(
        updateDoc(doc(db, 'jobPostings', postId), {
          title: 'Updated Title',
        })
      );
    });

    test('스태프는 다른 사람의 공고를 수정할 수 없어야 함', async () => {
      const userId = 'user1';
      const otherUserId = 'user2';
      const postId = 'post1';
      const db = testEnv.authenticatedContext(userId, { role: 'staff' }).firestore();
      
      // 다른 사용자의 공고 생성
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'jobPostings', postId), {
          title: 'Original Title',
          description: 'Description',
          location: 'Seoul',
          status: 'open',
          createdBy: otherUserId,
        });
      });

      // 수정 시도
      await assertFails(
        updateDoc(doc(db, 'jobPostings', postId), {
          title: 'Updated Title',
        })
      );
    });
  });

  describe('Staff Collection', () => {
    test('인증된 사용자는 스태프 정보를 읽을 수 있어야 함', async () => {
      const userId = 'user1';
      const staffId = 'staff1';
      const db = testEnv.authenticatedContext(userId, { role: 'staff' }).firestore();
      
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'staff', staffId), {
          userId: staffId,
          name: 'Staff Name',
          userRole: 'staff',
          jobRole: ['Dealer'],
          assignedEvents: [],
        });
      });

      await assertSucceeds(getDoc(doc(db, 'staff', staffId)));
    });

    test('역할이 있는 사용자만 스태프를 생성할 수 있어야 함', async () => {
      const userId = 'user1';
      const staffId = 'staff1';
      const db = testEnv.authenticatedContext(userId, { role: 'manager' }).firestore();
      
      await assertSucceeds(
        setDoc(doc(db, 'staff', staffId), {
          userId: 'newuser',
          name: 'New Staff',
          userRole: 'staff',
          jobRole: ['Dealer'],
          assignedEvents: [],
        })
      );
    });

    test('역할이 없는 사용자는 스태프를 생성할 수 없어야 함', async () => {
      const userId = 'user1';
      const staffId = 'staff1';
      const db = testEnv.authenticatedContext(userId).firestore(); // role 없음
      
      await assertFails(
        setDoc(doc(db, 'staff', staffId), {
          userId: 'newuser',
          name: 'New Staff',
          userRole: 'staff',
          jobRole: ['Dealer'],
          assignedEvents: [],
        })
      );
    });
  });

  describe('Work Logs Collection', () => {
    test('역할이 있는 사용자는 work log를 생성할 수 있어야 함', async () => {
      const userId = 'user1';
      const workLogId = 'worklog1';
      const db = testEnv.authenticatedContext(userId, { role: 'staff' }).firestore();
      
      await assertSucceeds(
        setDoc(doc(db, 'workLogs', workLogId), {
          dealerId: userId,
          date: '2024-07-25',
          scheduledStartTime: new Date(),
          scheduledEndTime: new Date(),
          status: 'scheduled',
        })
      );
    });

    test('사용자는 자신의 work log를 읽을 수 있어야 함', async () => {
      const userId = 'user1';
      const workLogId = 'worklog1';
      const db = testEnv.authenticatedContext(userId, { role: 'staff' }).firestore();
      
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'workLogs', workLogId), {
          dealerId: userId,
          date: '2024-07-25',
          scheduledStartTime: new Date(),
          scheduledEndTime: new Date(),
          status: 'scheduled',
        });
      });

      await assertSucceeds(getDoc(doc(db, 'workLogs', workLogId)));
    });

    test('일반 사용자는 work log를 삭제할 수 없어야 함', async () => {
      const userId = 'user1';
      const workLogId = 'worklog1';
      const db = testEnv.authenticatedContext(userId, { role: 'staff' }).firestore();
      
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'workLogs', workLogId), {
          dealerId: userId,
          date: '2024-07-25',
          status: 'scheduled',
        });
      });

      await assertFails(deleteDoc(doc(db, 'workLogs', workLogId)));
    });

    test('관리자는 work log를 삭제할 수 있어야 함', async () => {
      const adminId = 'admin1';
      const workLogId = 'worklog1';
      const db = testEnv.authenticatedContext(adminId, { role: 'admin' }).firestore();
      
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'workLogs', workLogId), {
          dealerId: 'someone',
          date: '2024-07-25',
          status: 'scheduled',
        });
      });

      await assertSucceeds(deleteDoc(doc(db, 'workLogs', workLogId)));
    });
  });

  describe('인증되지 않은 사용자', () => {
    test('인증되지 않은 사용자는 어떤 문서도 읽을 수 없어야 함', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      
      await assertFails(getDoc(doc(db, 'users', 'anyuser')));
      await assertFails(getDoc(doc(db, 'jobPostings', 'anypost')));
      await assertFails(getDoc(doc(db, 'staff', 'anystaff')));
      await assertFails(getDoc(doc(db, 'workLogs', 'anylog')));
    });

    test('인증되지 않은 사용자는 어떤 문서도 쓸 수 없어야 함', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      
      await assertFails(
        setDoc(doc(db, 'users', 'newuser'), { name: 'Test' })
      );
    });
  });
});