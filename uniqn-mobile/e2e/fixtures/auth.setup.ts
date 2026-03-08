/**
 * 인증 픽스처 — storageState 파일 검증
 *
 * storageState는 global-setup.ts에서 Firebase Auth REST API로 생성된다.
 * 이 setup은 storageState 파일이 올바르게 생성되었는지 확인만 수행한다.
 */
import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { TEST_ACCOUNTS } from './test-accounts';

const STORAGE_STATES_DIR = path.join(__dirname, 'storage-states');

for (const [roleName] of Object.entries(TEST_ACCOUNTS)) {
  setup(`verify storageState for ${roleName}`, async () => {
    const storageStatePath = path.join(STORAGE_STATES_DIR, `${roleName}.json`);

    // storageState 파일 존재 확인
    expect(
      fs.existsSync(storageStatePath),
      `storageState 파일이 없습니다: ${storageStatePath}\n` +
      `global-setup.ts에서 생성되어야 합니다.`
    ).toBe(true);

    // JSON 파싱 검증
    const content = JSON.parse(fs.readFileSync(storageStatePath, 'utf-8'));
    expect(content).toHaveProperty('origins');
    expect(content.origins).toHaveLength(1);
    expect(content.origins[0].localStorage.length).toBeGreaterThan(0);

    // Firebase Auth 엔트리 존재 확인
    const authEntry = content.origins[0].localStorage.find(
      (item: { name: string }) => item.name.startsWith('firebase:authUser:')
    );
    expect(
      authEntry,
      `Firebase Auth localStorage 엔트리가 없습니다 (${roleName})`
    ).toBeDefined();
  });
}
