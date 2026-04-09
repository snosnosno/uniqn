import globalSetup from './e2e/global-setup';
import { waitForAppReady } from './e2e/helpers/wait-helpers';
import { cleanupAdmin } from './e2e/helpers/firebase-admin';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

void (async () => {
  const appRoot = process.cwd();
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4101';
  const outDir = path.join(appRoot, 'output', 'playwright', 'board-audit');
  const results: Record<string, unknown>[] = [];
  const runtimeErrors: string[] = [];
  const created = {
    freePostId: '',
    freePostUrl: '',
    freeTitle: `E2E 자유게시판 ${Date.now()}`,
    tdaTitle: `E2E TDA ${Date.now()}`,
  };

  await fs.mkdir(outDir, { recursive: true });

  function record(
    name: string,
    status: 'PASS' | 'WARN',
    detail = '',
    extra: Record<string, unknown> = {}
  ) {
    results.push({ name, status, detail, ...extra });
    console.log(`${status} ${name}${detail ? ` :: ${detail}` : ''}`);
  }

  function attach(page: import('playwright').Page, label: string) {
    page.on('pageerror', (error) => {
      runtimeErrors.push(`[${label}] pageerror: ${error.message}`);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        runtimeErrors.push(`[${label}] console: ${msg.text()}`);
      }
    });
    page.on('dialog', async (dialog) => {
      runtimeErrors.push(`[${label}] dialog(${dialog.type()}): ${dialog.message()}`);
      await dialog.accept().catch(() => undefined);
    });
  }

  async function isVisible(locator: import('playwright').Locator) {
    return locator.isVisible().catch(() => false);
  }

  async function waitForServer(url: string, timeoutMs = 30000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const ok = await new Promise<boolean>((resolve) => {
        const req = http.get(url, (res) => {
          res.resume();
          resolve((res.statusCode ?? 500) < 500);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(2000, () => {
          req.destroy();
          resolve(false);
        });
      });
      if (ok) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Static server did not become ready: ${url}`);
  }

  async function startStaticServer() {
    const child = spawn('cmd.exe', ['/c', 'npx', 'serve', 'dist', '-l', '4101', '-s'], {
      cwd: appRoot,
      stdio: 'ignore',
    });
    await waitForServer(baseURL);
    return child;
  }

  function storageStatePath(name: string) {
    return path.join(appRoot, 'e2e', 'fixtures', 'storage-states', name);
  }

  async function newMobilePage(
    browser: import('playwright').Browser,
    storageState: string,
    label: string
  ) {
    const context = await browser.newContext({
      storageState: storageStatePath(storageState),
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });
    const page = await context.newPage();
    attach(page, label);
    return { context, page };
  }

  async function gotoReady(page: import('playwright').Page, route: string) {
    await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await page.waitForTimeout(600);
  }

  async function saveShot(page: import('playwright').Page, name: string) {
    await page.screenshot({
      path: path.join(outDir, name),
      fullPage: true,
    });
  }

  async function scrollDown(page: import('playwright').Page, times = 3) {
    for (let i = 0; i < times; i += 1) {
      await page.mouse.wheel(0, 1400);
      await page.waitForTimeout(250);
    }
  }

  let browser: import('playwright').Browser | undefined;
  let server: import('node:child_process').ChildProcess | undefined;
  try {
    await globalSetup();
    server = await startStaticServer();
    browser = await chromium.launch({ headless: true });

    const staff = await newMobilePage(browser, 'staff.json', 'staff');
    const staffPage = staff.page;

    await gotoReady(staffPage, '/board');
    const boardCards = ['공지사항', '내 일정게시판', '자유게시판', 'TDA 토론'];
    const boardCardStates = await Promise.all(
      boardCards.map((title) => isVisible(staffPage.getByText(title, { exact: true }).first()))
    );
    record(
      'staff-board-home',
      boardCardStates.every(Boolean) ? 'PASS' : 'WARN',
      JSON.stringify(boardCards.map((title, i) => [title, boardCardStates[i]]))
    );
    await saveShot(staffPage, '01-staff-board-home.png');

    await gotoReady(staffPage, '/board/invalid');
    record(
      'invalid-board-route',
      (await isVisible(staffPage.getByText('게시판을 찾을 수 없어요'))) ? 'PASS' : 'WARN'
    );

    await gotoReady(staffPage, '/board/write?boardType=notice');
    record(
      'notice-write-blocked',
      (await isVisible(staffPage.getByText('글을 작성할 수 없는 게시판이에요'))) ? 'PASS' : 'WARN'
    );

    await gotoReady(staffPage, '/board/free');
    const freeWriteButton = staffPage.getByLabel('글쓰기');
    const freeEmptyAction = staffPage.getByText('글쓰기', { exact: true });
    if (await isVisible(freeWriteButton)) {
      await freeWriteButton.click();
    } else if (await isVisible(freeEmptyAction)) {
      await freeEmptyAction.click();
    } else {
      throw new Error('자유게시판에서 글쓰기 진입 버튼을 찾지 못했습니다.');
    }
    await staffPage.waitForTimeout(600);
    const titleInput = staffPage.getByPlaceholder('제목을 입력해 주세요.');
    const bodyInput = staffPage.getByPlaceholder('내용을 입력해 주세요.');
    await titleInput.fill(created.freeTitle);
    await bodyInput.fill('Playwright 기반 자유게시판 생성/수정/잠금/댓글 흐름 점검용 본문입니다.');
    await saveShot(staffPage, '02-free-write-form.png');
    await staffPage.getByRole('button', { name: '등록하기' }).click();
    await staffPage.waitForURL(/\/board\/free/, { timeout: 15000 }).catch(() => undefined);
    await staffPage.waitForTimeout(1200);
    const freePostInList = staffPage.getByText(created.freeTitle).first();
    record(
      'free-post-create',
      (await isVisible(freePostInList)) ? 'PASS' : 'WARN',
      created.freeTitle
    );

    await freePostInList.click();
    await staffPage.waitForURL(/\/board\/post\//, { timeout: 15000 });
    created.freePostUrl = staffPage.url();
    created.freePostId = created.freePostUrl.match(/\/board\/post\/([^/?#]+)/)?.[1] || '';
    record('free-post-detail-open', created.freePostId ? 'PASS' : 'WARN', created.freePostUrl);
    await saveShot(staffPage, '03-free-post-detail.png');

    const likeButton = staffPage.getByRole('button', { name: /좋아요/ }).first();
    const likeBefore = await likeButton.textContent().catch(() => '');
    await likeButton.click();
    await staffPage.waitForTimeout(800);
    const likeAfter = await likeButton.textContent().catch(() => '');
    record(
      'free-post-like',
      likeBefore !== likeAfter ? 'PASS' : 'WARN',
      `${likeBefore} -> ${likeAfter}`
    );

    await scrollDown(staffPage, 4);
    const firstComment = '작성자 첫 댓글';
    await staffPage.getByLabel('댓글 내용').fill(firstComment);
    await staffPage.getByRole('button', { name: '등록' }).last().click();
    await staffPage.waitForTimeout(1200);
    record(
      'comment-create',
      (await isVisible(staffPage.getByText(firstComment).first())) ? 'PASS' : 'WARN'
    );

    await staffPage.getByText('수정').last().click();
    const editedComment = '작성자 댓글 수정 완료';
    await staffPage.getByLabel('댓글 내용').fill(editedComment);
    await staffPage.getByRole('button', { name: '등록' }).last().click();
    await staffPage.waitForTimeout(1000);
    record(
      'comment-edit',
      (await isVisible(staffPage.getByText(editedComment).first())) ? 'PASS' : 'WARN'
    );

    await staffPage.getByText('답글').first().click();
    const replyText = '작성자 답글';
    await staffPage.getByLabel('댓글 내용').fill(replyText);
    await staffPage.getByRole('button', { name: '등록' }).last().click();
    await staffPage.waitForTimeout(1000);
    record(
      'comment-reply',
      (await isVisible(staffPage.getByText(replyText).first())) ? 'PASS' : 'WARN'
    );

    await staffPage.getByText('삭제').last().click();
    await staffPage.waitForTimeout(1200);
    const deletedReplyVisible = await isVisible(staffPage.getByText('삭제된 댓글입니다.').first());
    record('comment-delete', deletedReplyVisible ? 'PASS' : 'WARN');

    await gotoReady(staffPage, new URL(created.freePostUrl).pathname);
    await staffPage.getByText('잠금', { exact: true }).first().click();
    await staffPage.waitForTimeout(1000);
    const unlockVisible = await isVisible(
      staffPage.getByText('잠금 해제', { exact: true }).first()
    );
    record('post-lock', unlockVisible ? 'PASS' : 'WARN');

    await gotoReady(staffPage, `/board/edit/${created.freePostId}`);
    const lockedEditText = (await staffPage.locator('body').textContent()) || '';
    const hasLockedMeaningfulText =
      lockedEditText.includes('잠긴 게시글') || lockedEditText.includes('잠금');
    record(
      'locked-post-edit-block',
      hasLockedMeaningfulText ? 'PASS' : 'WARN',
      lockedEditText.slice(0, 120)
    );
    await saveShot(staffPage, '04-locked-edit-screen.png');

    await gotoReady(staffPage, new URL(created.freePostUrl).pathname);
    await staffPage.getByText('잠금 해제', { exact: true }).first().click();
    await staffPage.waitForTimeout(1000);
    const postEditLink = staffPage.getByText('수정', { exact: true }).first();
    await postEditLink.click();
    await staffPage.waitForTimeout(700);
    const updatedTitle = `${created.freeTitle} 수정됨`;
    await staffPage.getByPlaceholder('제목을 입력해 주세요.').fill(updatedTitle);
    await staffPage.getByPlaceholder('내용을 입력해 주세요.').fill('수정 완료된 본문');
    await staffPage.getByRole('button', { name: '수정하기' }).click();
    await staffPage.waitForURL(/\/board\/post\//, { timeout: 15000 });
    await staffPage.waitForTimeout(1000);
    created.freeTitle = updatedTitle;
    record(
      'post-edit',
      (await isVisible(staffPage.getByText(updatedTitle).first())) ? 'PASS' : 'WARN'
    );

    await gotoReady(staffPage, '/board/tda');
    const tdaWriteButton = staffPage.getByLabel('글쓰기');
    if (await isVisible(tdaWriteButton)) {
      await tdaWriteButton.click();
      await staffPage.waitForTimeout(600);
      await staffPage.getByPlaceholder('제목을 입력해 주세요.').fill(created.tdaTitle);
      await staffPage.getByPlaceholder('내용을 입력해 주세요.').fill('TDA 토론 게시판 작성 테스트');
      await staffPage.getByRole('button', { name: '등록하기' }).click();
      await staffPage.waitForURL(/\/board\/tda/, { timeout: 15000 }).catch(() => undefined);
      await staffPage.waitForTimeout(1000);
      record(
        'tda-post-create',
        (await isVisible(staffPage.getByText(created.tdaTitle).first())) ? 'PASS' : 'WARN'
      );
    } else {
      record('tda-post-create', 'WARN', '글쓰기 버튼 미노출');
    }

    await gotoReady(staffPage, '/board/schedule');
    const scheduleBody = (await staffPage.locator('body').textContent()) || '';
    const scheduleHasContent =
      scheduleBody.includes('일정 요약') ||
      scheduleBody.includes('아직 게시글이 없어요') ||
      scheduleBody.includes('접근 가능한 일정 게시판이 아직 없어요');
    record(
      'schedule-board-access',
      scheduleHasContent ? 'PASS' : 'WARN',
      scheduleBody.slice(0, 120)
    );
    await saveShot(staffPage, '05-schedule-board.png');

    await gotoReady(staffPage, '/notices');
    const noticeHeaderVisible = await isVisible(staffPage.getByText('공지사항').first());
    record('notice-route-access', noticeHeaderVisible ? 'PASS' : 'WARN');

    await staff.context.close();

    const employer = await newMobilePage(browser, 'employer.json', 'employer');
    const employerPage = employer.page;
    await gotoReady(employerPage, new URL(created.freePostUrl).pathname);
    await scrollDown(employerPage, 4);
    const employerComment = '구인자 댓글';
    await employerPage.getByLabel('댓글 내용').fill(employerComment);
    await employerPage.getByRole('button', { name: '등록' }).last().click();
    await employerPage.waitForTimeout(1200);
    record(
      'employer-comment-on-free-post',
      (await isVisible(employerPage.getByText(employerComment).first())) ? 'PASS' : 'WARN'
    );

    await employerPage.getByText('신고').first().click();
    await employerPage.waitForTimeout(600);
    const reasonInput = employerPage.getByPlaceholder('신고 사유를 입력해 주세요.');
    const detailInput = employerPage.getByPlaceholder('추가 설명이 있다면 입력해 주세요.');
    await reasonInput.fill('테스트 신고 사유');
    await detailInput.fill('게시판 신고 관리 화면 노출 확인용');
    await employerPage.getByRole('button', { name: '신고하기' }).click();
    await employerPage.waitForTimeout(1200);
    const reportModalGone = !(await isVisible(employerPage.locator('[role="dialog"]')));
    record('report-submit', reportModalGone ? 'PASS' : 'WARN');

    await gotoReady(employerPage, `/board/edit/${created.freePostId}`);
    const unauthorizedEditText = (await employerPage.locator('body').textContent()) || '';
    const unauthorizedLooksReadable =
      unauthorizedEditText.includes('수정') || unauthorizedEditText.includes('권한');
    record(
      'unauthorized-edit-block',
      unauthorizedLooksReadable ? 'PASS' : 'WARN',
      unauthorizedEditText.slice(0, 120)
    );
    await saveShot(employerPage, '06-unauthorized-edit-screen.png');
    await employer.context.close();

    const admin = await newMobilePage(browser, 'admin.json', 'admin');
    const adminPage = admin.page;
    await gotoReady(adminPage, new URL(created.freePostUrl).pathname);
    const hideButton = adminPage.getByText('숨김', { exact: true }).first();
    if (await isVisible(hideButton)) {
      await hideButton.click();
      await adminPage.waitForTimeout(1200);
      const redirectedToList = /\/board\/free/.test(new URL(adminPage.url()).pathname);
      record('admin-hide-post', redirectedToList ? 'PASS' : 'WARN', adminPage.url());
    } else {
      record('admin-hide-post', 'WARN', '숨김 버튼 미노출');
    }

    await gotoReady(adminPage, '/admin');
    const boardReportEntry = adminPage.getByText('게시판 신고').first();
    if (await isVisible(boardReportEntry)) {
      await boardReportEntry.click();
      await adminPage.waitForTimeout(1200);
      const adminReportBody = (await adminPage.locator('body').textContent()) || '';
      const boardReportAccessible =
        adminReportBody.includes('게시판 신고') ||
        adminReportBody.includes('게시글 신고') ||
        adminReportBody.includes('사유, 신고자, 게시글 검색');
      record(
        'admin-board-report-screen',
        boardReportAccessible ? 'PASS' : 'WARN',
        adminReportBody.slice(0, 160)
      );
      await saveShot(adminPage, '07-admin-board-reports.png');
    } else {
      record('admin-board-report-screen', 'WARN', '대시보드에서 게시판 신고 진입점 미노출');
    }
    await admin.context.close();
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
    if (server && !server.killed) {
      server.kill();
    }
    await cleanupAdmin().catch(() => undefined);
    console.log('AUDIT_RESULTS_START');
    console.log(JSON.stringify({ results, runtimeErrors }, null, 2));
    console.log('AUDIT_RESULTS_END');
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
