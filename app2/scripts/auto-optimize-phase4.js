#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Phase 4: 2-3개 중복값 최적화
const OPTIMIZATIONS = [
  // 1. "생성 중..." / "Generating..." (3개)
  {
    koValue: '생성 중...',
    enValue: 'Generating...',
    existingKey: 'common.messages.generating',
    removeKeys: [
      'staffNew.buttonCreating',
      'shiftSchedule.generating'
    ]
  },

  // 2. "고정" / "Fixed" (3개)
  {
    koValue: '고정',
    enValue: 'Fixed',
    newKey: 'common.fixed',
    removeKeys: [
      'jobBoard.types.fixed',
      'jobPostingAdmin.form.typeFixed',
      'jobPostingAdmin.manage.typeFixed'
    ]
  },

  // 3. "지원하기" / "Apply" (3개)
  {
    koValue: '지원하기',
    enValue: 'Apply',
    newKey: 'common.apply',
    removeKeys: [
      'jobBoard.apply',
      'jobBoard.applyNow',
      'jobBoard.applyModal.title'
    ]
  },

  // 4. "이벤트" / "Event" (3개)
  {
    koValue: '이벤트',
    enValue: 'Event',
    newKey: 'common.event',
    removeKeys: [
      'profilePage.tableEvent',
      'payrollPage.tableEvent',
      'report.eventTitle'
    ]
  },

  // 5. "총 급여" / "Total Pay" (3개)
  {
    koValue: '총 급여',
    enValue: 'Total Pay',
    newKey: 'common.totalPay',
    removeKeys: [
      'payrollPage.totalPay',
      'payroll.summary.totalPay',
      'payroll.details.totalPay'
    ]
  },

  // 6. "거절" / "Reject" (2개)
  {
    koValue: '거절',
    enValue: 'Reject',
    newKey: 'common.reject',
    removeKeys: [
      'reject',
      'jobPostingAdmin.applicants.statusValue.rejected'
    ]
  },

  // 7. "남성" / "Male" (2개)
  {
    koValue: '남성',
    enValue: 'Male',
    newKey: 'common.male',
    removeKeys: [
      'gender.male',
      'signUp.genderMale'
    ]
  },

  // 8. "여성" / "Female" (2개)
  {
    koValue: '여성',
    enValue: 'Female',
    newKey: 'common.female',
    removeKeys: [
      'gender.female',
      'signUp.genderFemale'
    ]
  },

  // 9. "로그인" / "Login" (2개)
  {
    koValue: '로그인',
    enValue: 'Login',
    newKey: 'common.login',
    removeKeys: [
      'login.title',
      'login.loginButton'
    ]
  },

  // 10. "확인" / "Confirm" (2개) - common.confirm 이미 존재
  {
    koValue: '확인',
    enValue: 'Confirm',
    existingKey: 'common.confirm',
    removeKeys: [
      'modal.confirm'
    ]
  },

  // 11. "스태프" / "Staff" (2개)
  {
    koValue: '스태프',
    enValue: 'Staff',
    newKey: 'common.staff',
    removeKeys: [
      'signUp.roleStaff',
      'staffNew.roleStaff'
    ]
  },

  // 12. "테이블" / "Table" (2개)
  {
    koValue: '테이블',
    enValue: 'Table',
    newKey: 'common.table',
    removeKeys: [
      'nav.tables',
      'participantDetailModal.labelTable'
    ]
  },

  // 13. "총 근무 시간" / "Total Hours" (3개)
  {
    koValue: '총 근무 시간',
    enValue: 'Total Hours',
    newKey: 'common.totalHours',
    removeKeys: [
      'payrollPage.totalHours',
      'attendance.labels.totalHours',
      'payroll.summary.totalHours'
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

console.log('\n🚀 Phase 4: 2-3개 중복값 최적화\n');

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

console.log('\n✅ Phase 4 완료!');
console.log('\n📊 통계:');
console.log(`  - 새 키 추가: ${totalNewKeys}개 (common 섹션)`);
console.log(`  - 코드 변경: ${totalCodeChanges}개 위치`);
console.log(`  - 번역 키 제거: ${totalKeysRemoved}개`);
console.log('\n다음 단계: npm run build');
