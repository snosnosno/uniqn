/**
 * W2 인증 완료 기준(설계 §9) — 로컬 전용.
 *   비로그인 → 로그인 → 원래 경로 복귀 · `//evil`·`\` redirect 거부 · 미완성 계정 → 안내 화면
 *   + 오답 비밀번호 · 로그아웃 · 비밀번호 재설정 왕복
 * 실행: node e2e/w2-auth.mjs (전제는 e2e/lib.mjs 참고)
 */
import {
  BASE,
  INCOMPLETE,
  OWNER,
  assert,
  chromium,
  finish,
  latestMailText,
  localAnonKey,
  login,
  prepareLocal,
  screenshots,
  step,
} from './lib.mjs';

/** 이 페이지(브라우저 컨텍스트)의 refresh 토큰으로 GoTrue 토큰 갱신이 되는지 — 세션이 서버에서 살아 있는지. */
async function refreshStillValid(page) {
  const refreshToken = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    return key ? JSON.parse(localStorage.getItem(key)).refresh_token : null;
  });
  if (!refreshToken) throw new Error('refresh 토큰을 찾지 못했습니다');
  const res = await fetch('http://127.0.0.1:54321/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: { apikey: localAnonKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return res.ok;
}

prepareLocal();
const browser = await chromium.launch();
const fresh = async () => (await browser.newContext()).newPage();

process.stdout.write('W2 인증\n');

await step('비로그인으로 콘솔 딥링크 → /login?redirect=원래경로', async () => {
  const page = await fresh();
  await page.goto(`${BASE}/tournaments/abc/players?x=1`);
  await page.waitForURL(/\/login\?redirect=/);
  const url = new URL(page.url());
  assert(
    url.searchParams.get('redirect') === '/tournaments/abc/players?x=1',
    `redirect=${url.searchParams.get('redirect')}`
  );
  await page.context().close();
});

await step('로그인 → 원래 경로(쿼리 포함)로 복귀', async () => {
  const page = await fresh();
  await page.goto(`${BASE}/tournaments/abc/players?x=1`);
  await page.waitForURL(/\/login/);
  await login(page, OWNER);
  await page.waitForURL(`${BASE}/tournaments/abc/players?x=1`);
  // 콘솔은 AppLayout(이메일 머리줄) 밖이라 로그인 폼이 사라졌는지로 판정한다(없는 id 면 콘솔이 안내를 띄운다).
  await page.getByRole('link', { name: '대회 목록으로' }).first().waitFor();
  assert(
    (await page.getByRole('heading', { name: '로그인' }).count()) === 0,
    '로그인 폼이 남아 있음'
  );
  await page.context().close();
});

for (const evil of [
  '//evil.example',
  '/\\evil.example',
  'https://evil.example',
  '/.//evil.example',
  '/%2e%2e//evil.example',
]) {
  await step(`redirect=${evil} 는 거부 → /tournaments`, async () => {
    const page = await fresh();
    await page.goto(`${BASE}/login?redirect=${encodeURIComponent(evil)}`);
    await login(page, OWNER);
    await page.waitForURL(`${BASE}/tournaments`);
    assert(new URL(page.url()).origin === BASE, `이탈: ${page.url()}`);
    await page.context().close();
  });
}

await step('오답 비밀번호 → 한글 오류, 머무름', async () => {
  const page = await fresh();
  await page.goto(`${BASE}/login`);
  await login(page, OWNER, 'WrongPass1!');
  await page
    .getByRole('alert')
    .filter({ hasText: '이메일 또는 비밀번호가 올바르지 않습니다' })
    .waitFor();
  assert(page.url().startsWith(`${BASE}/login`), page.url());
  await page.context().close();
});

await step('형식 오류(빈 칸)는 서버 호출 없이 필드 오류', async () => {
  const page = await fresh();
  await page.goto(`${BASE}/login`);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.getByText('비밀번호를 입력해주세요').waitFor();
  await page.context().close();
});

await step('미완성 계정 → 가입 마무리 안내 + 로그아웃', async () => {
  const page = await fresh();
  await page.goto(`${BASE}/tournaments`);
  await page.waitForURL(/\/login/);
  await login(page, INCOMPLETE);
  await page.getByRole('heading', { name: '가입을 마무리해 주세요' }).waitFor();
  const link = page.getByRole('link', { name: /UNIQN 에서 마무리하기/ });
  assert((await link.getAttribute('href')) === 'https://uniqn.app', '링크 대상');
  await page.getByRole('button', { name: '로그아웃' }).click();
  await page.waitForURL(`${BASE}/login`);
  await page.context().close();
});

await step('로그아웃 후 콘솔 접근 → 다시 로그인으로', async () => {
  const page = await fresh();
  await page.goto(`${BASE}/login`);
  await login(page, OWNER);
  await page.waitForURL(`${BASE}/tournaments`);
  await page.getByRole('button', { name: '로그아웃' }).click();
  await page.waitForURL(`${BASE}/login`);
  await page.goto(`${BASE}/tournaments`);
  await page.waitForURL(/\/login/);
  await page.context().close();
});

await step('이미 로그인된 상태로 /login → 폼 없이 복귀 경로로', async () => {
  const page = await fresh();
  await page.goto(`${BASE}/login`);
  await login(page, OWNER);
  await page.waitForURL(`${BASE}/tournaments`);
  await page.goto(`${BASE}/login?redirect=%2Ftournaments%2Fx`);
  await page.waitForURL(`${BASE}/tournaments/x`);
  await page.context().close();
});

await step('한 기기 로그아웃은 다른 기기 세션을 끊지 않는다(scope local)', async () => {
  const a = await fresh();
  const b = await fresh();
  for (const page of [a, b]) {
    await page.goto(`${BASE}/login`);
    await login(page, OWNER);
    await page.waitForURL(`${BASE}/tournaments`);
  }
  await a.getByRole('button', { name: '로그아웃' }).click();
  await a.waitForURL(`${BASE}/login`);
  assert(await refreshStillValid(b), '다른 기기의 refresh 토큰이 폐기됐습니다(global 로그아웃)');
  await a.context().close();
  await b.context().close();
});

await step('일반 로그인 세션으로 /reset-password → 폼 대신 안내(공용 PC 탈취 방지)', async () => {
  const page = await fresh();
  await page.goto(`${BASE}/login`);
  await login(page, OWNER);
  await page.waitForURL(`${BASE}/tournaments`);
  await page.goto(`${BASE}/reset-password`);
  await page.getByRole('heading', { name: '재설정 링크로 들어와 주세요' }).waitFor();
  assert((await page.getByLabel('새 비밀번호', { exact: true }).count()) === 0, '폼이 보입니다');
  await page.context().close();
});

await step('비밀번호 재설정 메일 → 링크 → 새 비밀번호 → 새 비밀번호로 로그인', async () => {
  const page = await fresh();
  const sentAfter = Date.now() - 1000;
  await page.goto(`${BASE}/forgot-password`);
  await page.getByLabel('이메일').fill(OWNER);
  await page.getByRole('button', { name: '재설정 링크 보내기' }).click();
  await page.getByRole('heading', { name: '메일을 확인해 주세요' }).waitFor();

  const text = await latestMailText(OWNER, { after: sentAfter });
  const verifyUrl = /(http:\/\/127\.0\.0\.1:54321\/auth\/v1\/verify\?[^\s)"]+)/.exec(text)?.[1];
  assert(verifyUrl, '메일에 verify 링크 없음');
  const redirectTo = new URL(verifyUrl.replaceAll('&amp;', '&')).searchParams.get('redirect_to');
  assert(redirectTo === `${BASE}/reset-password`, `redirect_to=${redirectTo}`);

  // 로컬 auth 설정의 허용 목록에 이 포트가 없으면 GoTrue 는 site_url 로 보낸다 — 토큰(해시)만 옮긴다.
  const res = await fetch(verifyUrl.replaceAll('&amp;', '&'), { redirect: 'manual' });
  const landed = res.headers.get('location') ?? '';
  const hash = landed.slice(landed.indexOf('#'));
  assert(hash.includes('type=recovery'), `recovery 해시 없음: ${landed.slice(0, 80)}`);
  await page.goto(`${BASE}/reset-password${hash}`);
  await page.getByRole('heading', { name: '새 비밀번호' }).waitFor();

  // recovery 세션은 콘솔 출입증이 아니다 — 비밀번호를 바꾸기 전엔 재설정 화면으로 되돌린다.
  await page.goto(`${BASE}/tournaments`);
  await page.waitForURL(`${BASE}/reset-password`);
  await page.getByRole('heading', { name: '새 비밀번호' }).waitFor();

  await page.getByLabel('새 비밀번호', { exact: true }).fill('short');
  await page.getByLabel('새 비밀번호 확인').fill('short');
  await page.getByRole('button', { name: '비밀번호 바꾸기' }).click();
  await page.getByText('비밀번호는 최소 8자 이상이어야 합니다').waitFor();

  await page.getByLabel('새 비밀번호', { exact: true }).fill('NewPass2@x');
  await page.getByLabel('새 비밀번호 확인').fill('NewPass2@x');
  await page.getByRole('button', { name: '비밀번호 바꾸기' }).click();
  await page.waitForURL(`${BASE}/tournaments`);
  await page.getByRole('button', { name: '로그아웃' }).click();
  await page.waitForURL(`${BASE}/login`);
  await login(page, OWNER, 'NewPass2@x');
  await page.waitForURL(`${BASE}/tournaments`);
  await page.context().close();
});

await step('만료·사용된 재설정 링크(세션 없음) → 다시 받기 안내', async () => {
  const page = await fresh();
  await page.goto(`${BASE}/reset-password`);
  await page.getByRole('heading', { name: '링크가 만료됐어요' }).waitFor();
  await page.context().close();
});

await step('스크린샷 375/768/1280 × 다크/라이트 (로그인·미완성 안내)', async () => {
  await screenshots(browser, '/login?redirect=%2Ftournaments', 'w2-login');
  await screenshots(browser, '/tournaments', 'w2-incomplete', {
    prepare: async (page) => {
      await page.goto(`${BASE}/login`);
      await login(page, INCOMPLETE);
      await page.getByRole('heading', { name: '가입을 마무리해 주세요' }).waitFor();
    },
  });
});

await browser.close();
finish();
