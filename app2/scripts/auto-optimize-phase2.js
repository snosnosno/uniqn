#!/usr/bin/env node

/**
 * Phase 2: 새 common 키 생성 자동 최적화
 *
 * common 섹션에 없는 중복 값들을 새로운 common 키로 통합
 * - common 섹션에 새 키 추가
 * - 코드: t('signUp.nameLabel') → t('common.name')
 * - 번역 파일: signUp.nameLabel 키 제거
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const SRC_DIR = path.join(__dirname, '../src');
const KO_FILE = path.join(__dirname, '../public/locales/ko/translation.json');
const EN_FILE = path.join(__dirname, '../public/locales/en/translation.json');

// Phase 2 최적화 대상 (새로운 common 키 생성)
const OPTIMIZATIONS = [
  {
    koValue: '이름',
    enValue: 'Name',
    newKey: 'common.name',
    removeKeys: [
      'signUp.nameLabel',
      'signUp.namePlaceholder',
      'approvalPage.nameHeader',
      'staffNew.labelName',
      'editUserModal.labelName',
      'participants.tableHeaderName',
      'participants.modalLabelName',
      'participantDetailModal.labelName',
      'historyDetail.name',
      'report.targetName'
    ]
  },
  {
    koValue: '이메일 주소',
    enValue: 'Email Address',
    newKey: 'common.emailAddress',
    removeKeys: [
      'login.emailLabel',
      'login.emailPlaceholder',
      'forgotPassword.emailLabel',
      'forgotPassword.emailPlaceholder',
      'signUp.emailLabel',
      'signUp.emailPlaceholder',
      'staffNew.labelEmail'
    ]
  },
  {
    koValue: '날짜',
    enValue: 'Date',
    newKey: 'common.date',
    removeKeys: [
      'historyDetail.date',
      'historyPage.date',
      'jobPostingAdmin.manage.date',
      'profilePage.tableDate',
      'payrollPage.tableDate',
      'attendance.date',
      'report.eventDate'
    ]
  },
  {
    koValue: '연락처',
    enValue: 'Phone',
    newKey: 'common.phone',
    removeKeys: [
      'signUp.phoneLabel',
      'signUp.phonePlaceholder',
      'participants.tableHeaderPhone',
      'participants.modalLabelPhone',
      'participantDetailModal.labelPhone',
      'profile.phone'
    ]
  },
  {
    koValue: '상태',
    enValue: 'Status',
    newKey: 'common.status',
    removeKeys: [
      'payrollAdmin.tableHeaderStatus',
      'participants.tableHeaderStatus',
      'participantDetailModal.labelStatus',
      'jobPostingAdmin.edit.status',
      'profilePage.tableStatus',
      'payrollPage.tableStatus'
    ]
  },
  {
    koValue: '지역',
    enValue: 'Location',
    newKey: 'common.location',
    removeKeys: [
      'participants.tableHeaderLocation',
      'jobBoard.filters.location',
      'jobPostingAdmin.manage.location'
    ]
  },
  {
    koValue: '시간',
    enValue: 'Time',
    newKey: 'common.time',
    removeKeys: [
      'jobPostingAdmin.manage.time',
      'jobPostingAdmin.form.time'
    ]
  }
];

// TypeScript 파일 찾기
function findTsFiles() {
  return glob.sync(path.join(SRC_DIR, '**/*.{ts,tsx}'), {
    ignore: ['**/node_modules/**', '**/build/**', '**/*.test.ts', '**/*.test.tsx']
  });
}

// 파일에서 번역 키 교체
function replaceInFile(filePath, oldKey, newKey) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  // 작은따옴표 버전
  const regex1 = new RegExp(`t\\('${oldKey.replace(/\./g, '\\.')}'\\)`, 'g');
  if (regex1.test(content)) {
    content = content.replace(regex1, `t('${newKey}')`);
    changed = true;
  }

  // 큰따옴표 버전
  const regex2 = new RegExp(`t\\("${oldKey.replace(/\./g, '\\.')}"\\)`, 'g');
  if (regex2.test(content)) {
    content = content.replace(regex2, `t("${newKey}")`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
  }

  return changed;
}

// 코드에서 번역 키 교체
function replaceInCode(oldKey, newKey) {
  const files = findTsFiles();
  let count = 0;

  files.forEach(file => {
    if (replaceInFile(file, oldKey, newKey)) {
      count++;
    }
  });

  return count;
}

// 번역 파일에 새 키 추가
function addKeyToTranslation(filePath, key, value) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const translation = JSON.parse(content);

  const parts = key.split('.');
  let current = translation;

  // 부모 객체까지 생성/탐색
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }

  // 마지막 키 추가
  const lastKey = parts[parts.length - 1];
  if (current[lastKey] === undefined) {
    current[lastKey] = value;
    fs.writeFileSync(filePath, JSON.stringify(translation, null, 2) + '\n');
    return true;
  }

  return false;
}

// 번역 파일에서 키 제거
function removeKeyFromTranslation(filePath, key) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const translation = JSON.parse(content);

  const parts = key.split('.');
  let current = translation;

  // 부모 객체까지 탐색
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      return false;
    }
    current = current[parts[i]];
  }

  // 마지막 키 제거
  const lastKey = parts[parts.length - 1];
  if (current[lastKey] !== undefined) {
    delete current[lastKey];
    fs.writeFileSync(filePath, JSON.stringify(translation, null, 2) + '\n');
    return true;
  }

  return false;
}

// 메인 실행
function main() {
  console.log('🚀 Phase 2: 새 common 키 생성 최적화\n');

  let totalFilesChanged = 0;
  let totalKeysAdded = 0;
  let totalKeysRemoved = 0;

  OPTIMIZATIONS.forEach((opt, index) => {
    console.log(`\n${index + 1}. "${opt.koValue}" → ${opt.newKey}`);
    console.log(`   제거할 키: ${opt.removeKeys.length}개\n`);

    // common 섹션에 새 키 추가
    const koAdded = addKeyToTranslation(KO_FILE, opt.newKey, opt.koValue);
    const enAdded = addKeyToTranslation(EN_FILE, opt.newKey, opt.enValue);

    if (koAdded || enAdded) {
      totalKeysAdded++;
      console.log(`  ➕ ${opt.newKey} 추가: ko${koAdded ? ' ✓' : ''}, en${enAdded ? ' ✓' : ''}\n`);
    }

    // 코드 변경 및 번역 키 제거
    opt.removeKeys.forEach(oldKey => {
      const filesChanged = replaceInCode(oldKey, opt.newKey);

      if (filesChanged > 0) {
        console.log(`  ✅ ${oldKey}`);
        console.log(`     코드: ${filesChanged}개 파일 변경`);
        totalFilesChanged += filesChanged;

        // 번역 파일에서 제거
        const koRemoved = removeKeyFromTranslation(KO_FILE, oldKey);
        const enRemoved = removeKeyFromTranslation(EN_FILE, oldKey);

        if (koRemoved || enRemoved) {
          totalKeysRemoved++;
          console.log(`     번역: ko.json${koRemoved ? ' ✓' : ''}, en.json${enRemoved ? ' ✓' : ''}`);
        }
      } else {
        console.log(`  ⚠️  ${oldKey} - 사용처 없음 (번역 파일만 정리)`);

        // 사용되지 않더라도 번역 파일에서는 제거
        removeKeyFromTranslation(KO_FILE, oldKey);
        removeKeyFromTranslation(EN_FILE, oldKey);
        totalKeysRemoved++;
      }
    });
  });

  console.log('\n\n✅ Phase 2 완료!\n');
  console.log(`📊 통계:`);
  console.log(`  - 새 키 추가: ${totalKeysAdded}개 (common 섹션)`);
  console.log(`  - 코드 변경: ${totalFilesChanged}개 위치`);
  console.log(`  - 번역 키 제거: ${totalKeysRemoved}개`);
  console.log(`\n다음 단계:`);
  console.log(`  npm run type-check && npm run build`);
}

main();
