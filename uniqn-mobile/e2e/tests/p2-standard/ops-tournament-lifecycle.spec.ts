/**
 * 대회운영(ops) 라이브 운영 루프 — 결함 ②③④ 의 브라우저 레벨 회귀망.
 *
 * ①~⑥ 은 jest + pgTAP 으로만 덮여 있었다(결함⑦-4: ops E2E 0건). 유닛은 컴포넌트를 고립시켜
 * 검증하므로 **화면들이 실제로 이어지는지**는 증명하지 못한다 — 생성 폼이 저장되고, 상세로
 * 넘어가고, 참가자가 목록에 뜨고, 액션시트가 열리고, 상태 전이가 화면에 반영되는 그 연결이
 * 이 스펙의 대상이다.
 *
 * 각 테스트가 앞 테스트의 산출물(대회 → 참가자)에 의존하므로 serial 이다. 앞이 깨지면 뒤는
 * skip 되어 "무엇이 처음 깨졌는지"가 바로 드러난다.
 *
 * ⚠️ 이 스펙은 **쓰기**를 한다(대회·참가자 생성). 로컬 Supabase 스택을 겨냥할 때만 실행할 것 —
 *    `e2e/config.ts` 가 원격을 겨냥한 시드 기본 비밀번호를 막지만, 회전된 비밀번호를 주입하면
 *    원격에도 쓸 수 있다. CI(e2e.yml)는 `supabase start` 로 로컬 스택을 쓴다.
 *
 * 정리: 마지막 테스트가 대회를 **보관**해 목록에서 치운다(hard delete 는 `ops_events`
 * append-only 트리거와 충돌해 불가능하다 — 보관이 유일한 정리 경로다).
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { waitForAppReady } from '../../helpers/wait-helpers';

/**
 * **그룹을 명시해야 한다** — `app/(admin)/tournaments/index.tsx` 가 같은 `/tournaments` 로
 * 매핑돼 맨 URL 은 admin 쪽이 이긴다(`app/(admin)/_layout.tsx:23` 이 비-admin 을 홈으로 보낸다).
 * 사유 전문은 `ops-route-access.spec.ts` 의 `OPS_LIST_PATH` 주석.
 */
const OPS_LIST_PATH = '/(ops)/tournaments';

/** 실행마다 고유 — 재실행 시 앞선 실행의 잔여 대회와 섞이지 않게 한다. */
const RUN_ID = String(Date.now()).slice(-6);
const TOURNAMENT_NAME = `E2E 대회 ${RUN_ID}`;
const PLAYER_NAME = `E2E 참가자 ${RUN_ID}`;

/**
 * 생성된 대회 id — 첫 테스트가 채우고 이후 테스트가 재진입·보관에 쓴다.
 * 상세는 `[id]` 라 admin 과 충돌하지 않지만, 재진입 경로도 그룹을 명시해 일관성을 유지한다.
 */
let tournamentId = '';
const detailPath = (): string => `${OPS_LIST_PATH}/${tournamentId}`;

/**
 * 🔑 expo-router 의 Stack 은 **이전 화면을 언마운트하지 않는다** — 목록에서 상세로 넘어가도
 * 목록의 대회명 노드가 DOM 에 `hidden` 으로 그대로 남는다. 그래서 맨 `getByText(...)` 는
 * 안 보이는 잔재를 먼저 집어 `toBeVisible` 이 "Received: hidden" 으로 실패하고,
 * 반대로 "사라졌는지"를 `toHaveCount(0)` 으로 볼 때는 잔재 때문에 영영 0이 되지 않는다.
 * 텍스트 단언은 **항상 보이는 노드만** 대상으로 한다.
 */
function visibleText(page: Page, text: string): Locator {
  return page.getByText(text).filter({ visible: true });
}

/**
 * 웹의 `confirmAction` 은 `window.confirm` 이다(`src/utils/confirmAction.ts`).
 * 핸들러를 미리 걸지 않으면 Playwright 가 자동 dismiss 해 **확인이 취소로 처리**된다.
 */
function acceptConfirmDialogs(page: Page): void {
  page.on('dialog', (dialog) => {
    void dialog.accept();
  });
}

async function gotoOpsList(page: Page): Promise<void> {
  await page.goto(OPS_LIST_PATH, { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await expect(page.getByText('라이브 운영')).toBeVisible({ timeout: 15_000 });
}

/** 상세 재진입 — 탭 스트립이 뜨면 콘솔 셸이 마운트된 것이다. */
async function gotoDetail(page: Page): Promise<void> {
  await page.goto(detailPath(), { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await expect(page.getByRole('tab', { name: '현황' })).toBeVisible({ timeout: 15_000 });
}

/** 참가 탭으로 전환 — 라벨에 인원수가 붙는다(`참가 ${n}`, OpsConsoleShell:40). */
async function openPlayersTab(page: Page): Promise<void> {
  await page.getByRole('tab', { name: /^참가/ }).click();
}

/** 참가자 행 → 액션시트. 행 라벨은 `#{entryNumber} {name} 액션`(PlayersTab:52). */
async function openParticipantSheet(page: Page): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`${PLAYER_NAME} 액션`) }).click();
}

test.describe.serial('ops 라이브 운영 루프', () => {
  test.setTimeout(90_000);

  test('대회를 만들면 상세로 이어지고, 날짜는 자유 텍스트가 아니다 (결함④)', async ({ page }) => {
    await gotoOpsList(page);

    // 헤더의 생성 진입점은 빈 상태·목록·에러 어느 분기에서도 유지된다(index.tsx:456) —
    // 빈 상태 CTA 를 쓰면 잔여 대회가 있을 때 못 찾는다.
    await page.getByRole('button', { name: '+ 대회' }).click();
    // 도착 판정은 폼 필드로 한다 — "대회 만들기" 텍스트는 빈 상태 CTA("첫 대회 만들기")·헤더
    // 타이틀·제출 버튼 **3곳**에 매칭돼 strict mode 를 위반한다.
    await expect(page.getByPlaceholder('예: 수요 딥스택')).toBeVisible({ timeout: 10_000 });

    // ── 결함④ 회귀망 ────────────────────────────────────────────────
    // 날짜가 손입력 TextInput 이던 시절 "7/1" 이 저장에 성공했고, `eventDate === 오늘` 정확
    // 문자열 비교인 '이어서 운영' 카드가 **조용히** 영영 안 떴다. 지금은 DatePicker 다.
    // 편집 가능한 textbox 가 날짜 필드 안에 다시 생기면 이 단언이 깨진다.
    const dateField = page.getByTestId('ops-create-event-date');
    await expect(dateField).toBeVisible();
    expect(await dateField.getByRole('textbox').count()).toBe(0);
    await expect(dateField.getByRole('button', { name: '날짜 선택' })).toBeVisible();
    // ────────────────────────────────────────────────────────────────

    await page.getByPlaceholder('예: 수요 딥스택').fill(TOURNAMENT_NAME);
    await page.getByRole('button', { name: '대회 만들기' }).click();

    // 생성 성공 = 상세로 replace(new.tsx:122).
    await page.waitForURL(/\/tournaments\/[0-9a-f-]{36}/, { timeout: 20_000 });
    await expect(page.getByRole('tab', { name: '현황' })).toBeVisible({ timeout: 15_000 });
    // 방금 만든 그 대회가 맞다 — 헤더에 이름이 보인다(목록에 남은 hidden 잔재는 제외).
    await expect(visibleText(page, TOURNAMENT_NAME).first()).toBeVisible({ timeout: 15_000 });

    // 주소는 그룹이 빠진 `/tournaments/<uuid>` 로 정규화된다 — id 만 뽑아 쓴다.
    tournamentId = new URL(page.url()).pathname.split('/').pop() ?? '';
    expect(tournamentId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('참가자를 등록하면 목록에 뜨고 노쇼로 표시된다 (결함②)', async ({ page }) => {
    acceptConfirmDialogs(page);
    await gotoDetail(page);

    await openPlayersTab(page);
    await page.getByRole('button', { name: '참가 등록' }).click();
    await page.getByLabel('참가자 이름').fill(PLAYER_NAME);
    // `exact` 필수 — 시트 제출 버튼 라벨 "등록"은 뒤에 남아 있는 FAB("참가 등록")의 부분
    // 문자열이라, 느슨하게 잡으면 두 개가 걸려 strict mode 를 위반한다.
    await page.getByRole('button', { name: '등록', exact: true }).click();

    // 새 대회는 테이블이 0개라 좌석 배정이 없다 → `ops_register_participant` 가 checked_in 으로
    // 넣는다. checked_in 이 바로 결함② 액션(노쇼)이 사는 구역이다.
    await expect(visibleText(page, PLAYER_NAME).first()).toBeVisible({ timeout: 15_000 });

    await openParticipantSheet(page);
    const noShowButton = page.getByTestId('ops-participant-mark-no-show');
    await expect(noShowButton).toBeVisible({ timeout: 10_000 });
    await noShowButton.click();

    // 상태 전이는 **목록 행**으로 판정한다 — 운영자가 실제로 보는 자리이자, 서버 반영 + 캐시
    // 무효화 + 재렌더가 모두 끝나야 바뀌는 값이다.
    //
    // ⚠️ 시트를 다시 열어 확인하지 않는다: `PlayersTab` 은 시트에 참가자 **객체를 복사해**
    //    넘기므로(PlayersTab:50), 시트가 닫히기 전에 행을 다시 누르면 옛 스냅샷을 든 인스턴스가
    //    그대로 남아 "행은 노쇼인데 시트는 아직 '노쇼 처리'" 상태가 관측된다(2026-08-08 실측).
    //    실사용에서는 시트가 닫힌 뒤 누르므로 문제되지 않지만, 테스트가 그 경합을 밟을 이유는 없다.
    //
    // (`accessibilityState` 는 react-native-web 에서 무효라 상태 속성이 아니라 **텍스트**로 판정한다.)
    await expect(
      page.getByRole('button', { name: new RegExp(`${PLAYER_NAME} 액션`) })
    ).toContainText('노쇼', { timeout: 15_000 });
  });

  test('오등록 참가자를 등록 취소하면 목록에서 사라진다 (결함③)', async ({ page }) => {
    acceptConfirmDialogs(page);
    await gotoDetail(page);

    await openPlayersTab(page);
    await openParticipantSheet(page);

    // 서버 게이트(checked_in|no_show + 플레이 이력 0 + 좌석 미점유)와 같은 조건에서만 노출된다.
    // 앞 테스트가 no_show 로 만들어 뒀으므로 보여야 한다.
    const deleteButton = page.getByTestId('ops-participant-delete');
    await expect(deleteButton).toBeVisible({ timeout: 10_000 });
    await deleteButton.click();

    await expect(visibleText(page, PLAYER_NAME)).toHaveCount(0, { timeout: 15_000 });
  });

  test('대회를 보관하면 목록에서 치워진다 (결함③)', async ({ page }) => {
    acceptConfirmDialogs(page);
    await gotoOpsList(page);

    await expect(visibleText(page, TOURNAMENT_NAME).first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId(`ops-archive-${tournamentId}`).click();

    // 보관은 목록에서 숨기는 것이다(hard delete 아님) — 기본 모드는 활성분만 렌더한다(index.tsx:384).
    await expect(visibleText(page, TOURNAMENT_NAME)).toHaveCount(0, { timeout: 15_000 });

    // 되돌릴 수 있다는 것이 '보관'의 계약이다 — 보관함 토글이 나타나 복원 경로를 남긴다.
    await expect(page.getByTestId('ops-archive-toggle')).toBeVisible({ timeout: 10_000 });
  });
});
