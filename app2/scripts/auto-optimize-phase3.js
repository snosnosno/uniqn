#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Phase 3: 빈도 높은 중복값들을 common으로 통합
const OPTIMIZATIONS = [
  {
    koValue: '지원',
    enValue: 'Application',
    newKey: 'common.application',
    removeKeys: [
      'jobBoard.types.application',
      'jobBoard.applyModal.submit',
      'jobPostingAdmin.form.typeApplication',
      'jobPostingAdmin.manage.typeApplication',
      'jobPostingAdmin.applicants.statusValue.applied'
    ]
  },
  {
    koValue: '기타',
    enValue: 'Other',
    newKey: 'common.other',
    removeKeys: [
      'locations.other',
      'report.types.other.label',
      'inquiry.categories.other.label',
      'settings.account.reason.other'
    ]
  },
  {
    koValue: '성별',
    enValue: 'Gender',
    newKey: 'common.gender',
    removeKeys: [
      'signUp.genderLabel',
      'staffListPage.gender',
      'jobPostingAdmin.applicants.gender',
      'profile.gender'
    ]
  },
  {
    koValue: '이메일',
    enValue: 'Email',
    newKey: 'common.email',
    removeKeys: [
      'approvalPage.emailHeader',
      'staffListPage.email',
      'editUserModal.labelEmail',
      'profile.email'
    ]
  },
  {
    koValue: '나이',
    enValue: 'Age',
    newKey: 'common.age',
    removeKeys: [
      'staffListPage.age',
      'jobPostingAdmin.applicants.age',
      'profile.age',
      'profilePage.age'
    ]
  },
  {
    koValue: '대기중',
    enValue: 'Pending',
    newKey: 'common.status.pending',
    removeKeys: [
      'participants.locationWaiting',
      'payrollPage.pendingAmount',
      'tableCard.waiting',
      'report.status.pending'
    ]
  },
  {
    koValue: '확정',
    enValue: 'Confirmed',
    newKey: 'common.status.confirmed',
    removeKeys: [
      'jobBoard.confirmed',
      'jobPostingAdmin.applicants.confirm',
      'jobPostingAdmin.applicants.statusValue.confirmed',
      'jobPostingAdmin.applicants.confirmed'
    ]
  },
  {
    koValue: '급여 내역',
    enValue: 'Payroll History',
    newKey: 'common.payrollHistory',
    removeKeys: [
      'profilePage.payrollHistory',
      'profilePage.viewPayroll',
      'payrollPage.title',
      'payrollPage.payrollHistory'
    ]
  },
  {
    koValue: '비밀번호',
    enValue: 'Password',
    newKey: 'common.password',
    removeKeys: [
      'login.passwordLabel',
      'login.passwordPlaceholder',
      'signUp.passwordLabel'
    ]
  },
  {
    koValue: '참가자',
    enValue: 'Participants',
    newKey: 'common.participants',
    removeKeys: [
      'nav.participants',
      'prizes.participants',
      'historyDetail.participants',
      'historyPage.participants'
    ]
  },
  {
    koValue: '오류',
    enValue: 'Error',
    newKey: 'common.error',
    removeKeys: [
      'dashboard.errorPrefix',
      'payrollPage.error',
      'shiftSchedule.error'
    ]
  },
  {
    koValue: '역할',
    enValue: 'Role',
    existingKey: 'common.role',
    removeKeys: [
      'staffNew.labelRole',
      'editUserModal.labelRole',
      'jobBoard.filters.role'
    ]
  },
  {
    koValue: '경력',
    enValue: 'Experience',
    newKey: 'common.experience',
    removeKeys: [
      'staffListPage.experience',
      'jobPostingAdmin.applicants.experience',
      'profile.experience'
    ]
  },
  {
    koValue: '해당 없음',
    enValue: 'N/A',
    newKey: 'common.notApplicable',
    removeKeys: [
      'dealerEvents.dateNotAvailable',
      'tables.dealerNotApplicable',
      'moveSeatModal.notApplicable',
      'participantDetailModal.notAvailable',
      'profilePage.notAvailable'
    ]
  },
  {
    koValue: '칩',
    enValue: 'Chips',
    newKey: 'common.chips',
    removeKeys: [
      'participants.tableHeaderChips',
      'participants.modalLabelChips',
      'participantDetailModal.labelChips'
    ]
  },
  {
    koValue: '지급 완료',
    enValue: 'Paid',
    newKey: 'common.status.paid',
    removeKeys: [
      'payrollAdmin.status.paid',
      'profilePage.statusPaid',
      'payrollPage.paidAmount',
      'payrollPage.statusPaid'
    ]
  }
];

const ROOT = path.join(__dirname, '..');

function getNestedValue(obj, key) {
  return key.split('.').reduce((o, k) => (o || {})[k], obj);
}

function setNestedValue(obj, key, value) {
  const keys = key.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((o, k) => {
    if (!o[k]) o[k] = {};
    return o[k];
  }, obj);
  target[lastKey] = value;
}

function deleteNestedKey(obj, key) {
  const keys = key.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((o, k) => (o || {})[k], obj);
  if (target) {
    delete target[lastKey];
  }
}

function addKeyToTranslation(filePath, key, value) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const existing = getNestedValue(content, key);
  if (existing) {
    console.log(`   ⚠️  키 이미 존재: ${key}`);
    return false;
  }
  setNestedValue(content, key, value);
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
  return true;
}

function removeKeyFromTranslation(filePath, key) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const existing = getNestedValue(content, key);
  if (!existing) {
    return false;
  }
  deleteNestedKey(content, key);
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
  return true;
}

function replaceInFile(filePath, oldKey, newKey) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const escapedOld = oldKey.replace(/\./g, '\\.');
  const pattern1 = `t\\('${escapedOld}'\\)`;
  const pattern2 = `t\\("${escapedOld}"\\)`;
  const regex1 = new RegExp(pattern1, 'g');
  const regex2 = new RegExp(pattern2, 'g');
  const before = content;
  content = content.replace(regex1, `t('${newKey}')`);
  content = content.replace(regex2, `t("${newKey}")`);
  if (content !== before) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }
  return false;
}

console.log('\n🚀 Phase 3: 빈도 높은 중복값 최적화\n');

const koPath = path.join(ROOT, 'public/locales/ko/translation.json');
const enPath = path.join(ROOT, 'public/locales/en/translation.json');

let totalNewKeys = 0;
let totalCodeChanges = 0;
let totalKeysRemoved = 0;

OPTIMIZATIONS.forEach((opt, index) => {
  console.log(`\n${index + 1}. "${opt.koValue}" → ${opt.newKey || opt.existingKey}`);

  if (opt.newKey) {
    const koAdded = addKeyToTranslation(koPath, opt.newKey, opt.koValue);
    const enAdded = addKeyToTranslation(enPath, opt.newKey, opt.enValue);
    if (koAdded || enAdded) {
      console.log(`   ➕ ${opt.newKey} 추가: ko ${koAdded ? '✓' : '⚠️'}, en ${enAdded ? '✓' : '⚠️'}`);
      totalNewKeys++;
    }
  } else if (opt.existingKey) {
    console.log(`   ♻️  기존 키 재사용: ${opt.existingKey}`);
  }

  const targetKey = opt.newKey || opt.existingKey;
  opt.removeKeys.forEach(oldKey => {
    const files = glob.sync('src/**/*.{ts,tsx}', { cwd: ROOT });
    let changed = 0;
    files.forEach(file => {
      const fullPath = path.join(ROOT, file);
      if (replaceInFile(fullPath, oldKey, targetKey)) {
        changed++;
      }
    });
    if (changed > 0) {
      console.log(`   ✅ ${oldKey} - 코드: ${changed}개 파일 변경`);
      totalCodeChanges += changed;
    }
    const koRemoved = removeKeyFromTranslation(koPath, oldKey);
    const enRemoved = removeKeyFromTranslation(enPath, oldKey);
    if (koRemoved || enRemoved) {
      totalKeysRemoved++;
    }
  });
});

console.log('\n✅ Phase 3 완료!');
console.log('\n📊 통계:');
console.log(`  - 새 키 추가: ${totalNewKeys}개 (common 섹션)`);
console.log(`  - 코드 변경: ${totalCodeChanges}개 위치`);
console.log(`  - 번역 키 제거: ${totalKeysRemoved}개`);
console.log('\n다음 단계: npm run type-check && npm run build');
