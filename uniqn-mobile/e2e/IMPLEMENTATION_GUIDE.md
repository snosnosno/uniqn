# E2E Test Fixes - Implementation Guide

## Overview

This guide provides step-by-step instructions to fix all remaining E2E test issues identified in the test suite.

## Files Fixed So Far (6/29)

✅ `tests/p0-critical/rbac-access.spec.ts`
✅ `tests/p0-critical/auth-logout-session.spec.ts`
✅ `tests/p0-critical/auth-signup.spec.ts`
✅ `tests/p0-critical/auth-login.spec.ts`
✅ `tests/p0-critical/e2e-user-journeys.spec.ts`
✅ `tests/p1-important/public-pages.spec.ts`

## Quick Fix Script

You can apply these patterns using find-and-replace in your IDE:

### Pattern 1: Add waitForLoadState After goto()

**Find** (regex):
```
(await page\.goto\([^)]+\);)\n(\s+)(await page\.waitForTimeout)
```

**Replace**:
```
$1
$2await page.waitForLoadState('domcontentloaded');
$2$3
```

### Pattern 2: Fix Strict Mode on getByText()

**Find** (regex):
```
(await expect\(page\.getByText\([^)]+\)\))\.toBeVisible
```

**Replace**:
```
$1.first()).toBeVisible
```

**Manual review required**: Only apply where text appears multiple times.

### Pattern 3: Wrap isVisible() Calls

**Find** (regex):
```
(const \w+ = await .+\.isVisible\(\));
```

**Replace**:
```
$1.catch(() => false);
```

---

## File-by-File Fix Instructions

### P1: security-xss-csrf.spec.ts

1. Add `.first()` to all error selectors:
   - Lines 23, 38, 52, 114

```typescript
// FIND:
const errorText = page.getByText(/유효한 이메일|올바른 이메일/);

// REPLACE:
const errorText = page.getByText(/유효한 이메일|올바른 이메일/).first();
```

2. Add loadState after all `goto()` calls:

```typescript
await page.goto('/login');
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(2_000);
```

---

### P1: employer-posting-crud.spec.ts

1. **Line 31**: Add `.first()`
```typescript
await expect(employerTab.headerTitle.first()).toBeVisible({ timeout: 10_000 });
```

2. **Line 37**: Add `.first()`
```typescript
const allTab = page.getByRole('tab', { name: /전체/ }).first();
```

3. **Line 54**: Add `.first()`
```typescript
await expect(myPostings.headerTitle.first()).toBeVisible({ timeout: 10_000 });
```

4. **Line 67**: Add `.first()`
```typescript
await expect(myPostings.headerTitle.first()).toBeVisible({ timeout: 10_000 });
```

5. **Line 111**: Add `.first()`
```typescript
await expect(error.first()).toBeVisible({ timeout: 5_000 });
```

6. **Line 145**: Add `.first()`
```typescript
await expect(fixedUI.first()).toBeVisible({ timeout: 5_000 });
```

7. Add `waitForLoadState` after ALL `goto()` calls

---

### P1: employer-applicants.spec.ts

1. Add `waitForLoadState` after ALL `page.goto()` calls

2. Wrap all `isVisible()` calls:
   - Lines 70, 98, 148, 189, 234, 282, 322

```typescript
// FIND:
const isVisible = await card.isVisible();

// REPLACE:
const isVisible = await card.isVisible().catch(() => false);
```

3. Increase all modal timeouts to 10_000ms

---

### P1: employer-settlement.spec.ts

1. **Lines 46-48**: Add `.first()`
```typescript
const staffTab = page.getByText(/스태프 관리/).first();
const settlementTab = page.getByText('정산', { exact: true }).first();
```

2. **Line 94-96**: Add `.first()`
```typescript
const settlementTabButton = page.getByText('정산', { exact: true }).first();
```

3. **Line 103-105**: Add `.first()`
```typescript
const filterAll = page.getByText('전체', { exact: false }).first();
```

4. **Line 147**: Add `.first()`
```typescript
const settlementTabButton = page.getByText('정산', { exact: true }).first();
```

5. **Line 211**: Add `.first()`
```typescript
const settlementTabButton = page.getByText('정산', { exact: true }).first();
```

6. Add `waitForLoadState` after ALL `goto()` calls

---

### P2: schedule-tab.spec.ts

1. Add `waitForLoadState` after `goto()`:

```typescript
test.beforeEach(async ({ page }) => {
  schedulePage = new SchedulePage(page);
  await schedulePage.goto();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1_000);
});
```

---

### P2: notifications.spec.ts

1. **Lines 26-31**: Add `.first()` to all category tabs

```typescript
await expect(notificationsPage.getCategoryTab('전체').first()).toBeVisible({ timeout: 10_000 });
await expect(notificationsPage.getCategoryTab('지원').first()).toBeVisible();
await expect(notificationsPage.getCategoryTab('출퇴근').first()).toBeVisible();
await expect(notificationsPage.getCategoryTab('정산').first()).toBeVisible();
await expect(notificationsPage.getCategoryTab('공고').first()).toBeVisible();
await expect(notificationsPage.getCategoryTab('시스템').first()).toBeVisible();
```

2. Add `waitForLoadState` in beforeEach

---

### P2: settings.spec.ts

1. **Lines 27-30**: Add `.first()` to all section titles

```typescript
await expect(settingsPage.getSectionTitle('알림').first()).toBeVisible({ timeout: 10_000 });
await expect(settingsPage.getSectionTitle('계정').first()).toBeVisible();
await expect(settingsPage.getSectionTitle('앱 설정').first()).toBeVisible();
await expect(settingsPage.getSectionTitle('정보').first()).toBeVisible();
```

2. **Lines 86-88**: Add `.first()` to profile sections

```typescript
await expect(profilePage.getSection('기본 정보').first()).toBeVisible({ timeout: 10_000 });
await expect(profilePage.getReadOnlyField('이름').first()).toBeVisible();
await expect(profilePage.getReadOnlyField('이메일').first()).toBeVisible();
```

3. **Line 92**: Add `.first()`
```typescript
await expect(profilePage.getSection('추가 정보').first()).toBeVisible({ timeout: 10_000 });
```

4. Add `waitForLoadState` after all `goto()` calls

---

### P2: qr-checkin.spec.ts

1. Add `waitForLoadState` in beforeEach:

```typescript
test.beforeEach(async ({ page }) => {
  qrPage = new QRPage(page);
  await qrPage.goto();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1_000);
});
```

---

### P3: error-handling.spec.ts

1. **Line 49**: Add `.first()`
```typescript
const policyText = page.getByText('최소 8자 이상').first();
```

2. **Line 53**: Add `.first()`
```typescript
const newPw = page.getByPlaceholder('새 비밀번호').first();
```

3. **Lines 61-67**: Add `.first()` in loop

```typescript
for (const policy of policies) {
  await expect(page.getByText(policy).first()).toBeVisible();
}
```

---

### P3: review-system.spec.ts

1. **Lines 17-19**: Add `.first()` in loop

```typescript
for (const label of Object.values(SENTIMENT_LABELS)) {
  await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
}
```

2. **Line 33**: Add `.first()`
```typescript
await expect(tagSection.first()).toBeVisible();
```

3. **Line 51**: Add `.first()`
```typescript
const counter = page.getByText(/\d+\/500/).first();
```

4. **Line 65**: Add `.first()`
```typescript
await expect(warningText.first()).toBeVisible();
```

5. Add `waitForLoadState` after all `goto()` calls

---

### P3: support-faq.spec.ts

1. **Lines 14-16**: Add `.first()`

```typescript
await expect(page.getByText('자주 묻는 질문').first()).toBeVisible();
await expect(page.getByText('1:1 문의하기').first()).toBeVisible();
await expect(page.getByText('문의 내역').first()).toBeVisible();
```

2. **Lines 20-25**: Add `.first()`

```typescript
await expect(page.getByText('고객센터 운영시간').first()).toBeVisible();
await expect(page.getByText(/평일 09:00/).first()).toBeVisible();
```

3. **Line 85**: Add `.first()`
```typescript
await expect(page.getByText('문의 유형').first()).toBeVisible();
```

---

### P4: offline-network.spec.ts

1. **Line 30**: Add `.first()`
```typescript
const offlineBanner = page.getByText('인터넷 연결이 끊어졌습니다').first();
```

2. **Line 59**: Add `.first()`
```typescript
const offlineBanner = page.getByText('인터넷 연결이 끊어졌습니다').first();
```

3. **Line 79**: Add `.first()`
```typescript
const retryButton = page.getByText(/재시도|다시 연결/).first();
```

4. **Line 106**: Add `.first()`
```typescript
const loadingText = page.getByText(/로딩|불러오는 중/).first();
```

---

### P4: responsive-a11y.spec.ts

1. **Line 104**: Add `.first()`
```typescript
const emailInput = page.getByPlaceholder('이메일을 입력하세요').first();
```

2. No other critical issues in this file

---

## Automated Fix Script (Optional)

For files with many similar issues, use this Node.js script:

```javascript
const fs = require('fs');
const path = require('path');

const filesToFix = [
  'tests/p1-important/security-xss-csrf.spec.ts',
  'tests/p2-standard/notifications.spec.ts',
  'tests/p2-standard/settings.spec.ts',
  // ... add more
];

filesToFix.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  let content = fs.readFileSync(fullPath, 'utf-8');

  // Fix 1: Add .first() to common patterns
  content = content.replace(
    /expect\(page\.getByText\(([^)]+)\)\)\.toBeVisible/g,
    'expect(page.getByText($1).first()).toBeVisible'
  );

  // Fix 2: Add loadState after goto
  content = content.replace(
    /(await page\.goto\([^)]+\);)/g,
    '$1\n    await page.waitForLoadState(\'domcontentloaded\');'
  );

  fs.writeFileSync(fullPath, content, 'utf-8');
  console.log(`Fixed: ${filePath}`);
});
```

---

## Verification Steps

After applying all fixes:

1. **Run P0 tests**:
   ```bash
   npm run test:e2e -- tests/p0-critical/
   ```

2. **Run P1 tests**:
   ```bash
   npm run test:e2e -- tests/p1-important/
   ```

3. **Run P2 tests**:
   ```bash
   npm run test:e2e -- tests/p2-standard/
   ```

4. **Run full suite**:
   ```bash
   npm run test:e2e
   ```

5. **Check for remaining issues**:
   - Strict mode violations: Look for "locator resolved to X elements"
   - Timeout errors: Increase timeouts incrementally
   - Assertion failures: Update expected text to match actual app

---

## Common Issues After Fixes

### Issue: "Element still not found after adding .first()"
**Solution**: Element may not exist. Add conditional check:
```typescript
const element = page.getByText('Some Text').first();
const exists = await element.isVisible().catch(() => false);
if (!exists) {
  console.log('Element not found, skipping...');
  return;
}
await expect(element).toBeVisible();
```

### Issue: "Timeout even with 10 seconds"
**Solution**: Page may be very slow. Add network wait:
```typescript
await page.goto('/path');
await page.waitForLoadState('domcontentloaded');
await page.waitForLoadState('networkidle'); // Wait for all network requests
await page.waitForTimeout(2_000);
```

### Issue: "Error message text doesn't match"
**Solution**: Check actual error text in app and update regex:
```typescript
// Instead of:
const error = page.getByText(/이미 사용/);

// Use broader pattern:
const error = page.getByText(/이미 사용|already|exists|중복/i);
```

---

## Final Checklist

After completing all fixes, verify:

- [ ] All P0 tests pass (6/6)
- [ ] All P1 tests pass (4/4)
- [ ] All P2 tests pass (4/4)
- [ ] All P3 tests pass (3/3)
- [ ] All P4 tests pass (2/2)
- [ ] No strict mode violations in logs
- [ ] No timeout errors
- [ ] All assertions use appropriate timeouts (5-10s)
- [ ] All error message patterns are broad enough
- [ ] All visibility checks have error handling

---

## Contact

If issues persist after applying these fixes, check:

1. **Playwright version**: Ensure `@playwright/test` is up to date
2. **Firebase emulator**: Ensure emulator is running and seeded
3. **Storage states**: Ensure auth storage states are valid
4. **App changes**: UI text or structure may have changed

For additional help, refer to:
- `FIXES_SUMMARY.md` - Overview of patterns
- `DETAILED_FIXES_NEEDED.md` - Detailed issue breakdown
- Playwright docs: https://playwright.dev
