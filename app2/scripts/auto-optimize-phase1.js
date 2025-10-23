#!/usr/bin/env node

/**
 * Phase 1: 기존 common 키 활용 자동 최적화
 *
 * 이미 common 섹션에 있는 키로 중복 제거
 * - 코드: t('userManagement.edit') → t('common.edit')
 * - 번역 파일: userManagement.edit 키 제거
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const SRC_DIR = path.join(__dirname, '../src');
const KO_FILE = path.join(__dirname, '../public/locales/ko/translation.json');
const EN_FILE = path.join(__dirname, '../public/locales/en/translation.json');

// Phase 1 최적화 대상 (이미 common에 존재하는 키)
const OPTIMIZATIONS = [
  {
    value: '로딩 중...',
    commonKey: 'common.messages.loading',
    removeKeys: [
      'loading',
      'layout.loading',
      'payrollAdmin.buttonLoading',
      'participants.loading',
      'tables.loading',
      'historyDetail.loading',
      'tournamentDashboard.loading',
      'notifications.loading'
    ]
  },
  {
    value: '수정',
    commonKey: 'common.edit',
    removeKeys: [
      'userManagement.edit',
      'participants.actionEdit',
      'participants.modalButtonUpdate',
      'participantDetailModal.buttonEdit',
      'jobPostingAdmin.manage.edit',
      'exceptions.edit'
    ]
  },
  {
    value: '취소',
    commonKey: 'common.cancel',
    removeKeys: [
      'participants.modalButtonCancel',
      'moveSeatModal.buttonCancel',
      'jobBoard.applyModal.cancel',
      'jobPosting.announcement.cancelButton',
      'profilePage.cancel',
      'shiftSchedule.cancel'
    ]
  },
  {
    value: '삭제',
    commonKey: 'common.delete',
    removeKeys: [
      'userManagement.delete',
      'common.remove',
      'participants.actionDelete',
      'jobPostingAdmin.manage.delete'
    ]
  },
  {
    value: '검색',
    commonKey: 'common.search',
    removeKeys: [
      'staffListPage.search',
      'jobBoard.search.label',
      'jobBoard.search.button',
      'jobBoard.filters.search.label'
    ]
  },
  {
    value: '전체',
    commonKey: 'common.all',
    removeKeys: [
      'jobBoard.filters.allMonths',
      'jobBoard.filters.allDays',
      'support.faq.all',
      'notifications.filters.all'
    ]
  },
  {
    value: '제출 중...',
    commonKey: 'common.messages.submitting',
    removeKeys: [
      'jobBoard.preQuestion.submitting',
      'support.inquiry.submitting',
      'report.submitting'
    ]
  },
  {
    value: '저장',
    commonKey: 'common.save',
    removeKeys: [
      'participantDetailModal.buttonSave',
      'availableTimes.saveButton',
      'shiftSchedule.save'
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
  console.log('🚀 Phase 1: 기존 common 키 활용 최적화\n');

  let totalFilesChanged = 0;
  let totalKeysRemoved = 0;

  OPTIMIZATIONS.forEach((opt, index) => {
    console.log(`\n${index + 1}. "${opt.value}" → ${opt.commonKey}`);
    console.log(`   제거할 키: ${opt.removeKeys.length}개\n`);

    opt.removeKeys.forEach(oldKey => {
      // 코드 변경
      const filesChanged = replaceInCode(oldKey, opt.commonKey);

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

  console.log('\n\n✅ Phase 1 완료!\n');
  console.log(`📊 통계:`);
  console.log(`  - 코드 변경: ${totalFilesChanged}개 위치`);
  console.log(`  - 번역 키 제거: ${totalKeysRemoved}개`);
  console.log(`\n다음 단계:`);
  console.log(`  npm run type-check && npm run build`);
}

main();
