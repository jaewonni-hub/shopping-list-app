import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LIB_DIR = '/tmp/nss_libs/extracted/usr/lib/x86_64-linux-gnu';
const EXTRA_LIB = '/home/home/.cache/camoufox';
process.env.LD_LIBRARY_PATH = `${LIB_DIR}:${EXTRA_LIB}:${process.env.LD_LIBRARY_PATH || ''}`;

const executablePath =
  '/home/home/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

const browser = await chromium.launch({
  executablePath,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  headless: true,
});

async function freshPage() {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`file://${path.join(__dirname, 'index.html')}`);
  return { page, context };
}

// ──────────────────────────────────────────────
console.log('\n[1] 초기 빈 상태');
// ──────────────────────────────────────────────
{
  const { page, context } = await freshPage();
  const emptyVisible = await page.locator('#empty').isVisible();
  const itemCount = await page.locator('#list li').count();
  assert(emptyVisible, '빈 상태 문구 표시');
  assert(itemCount === 0, '리스트 항목 0개');
  await context.close();
}

// ──────────────────────────────────────────────
console.log('\n[2] 아이템 추가 - 버튼 클릭');
// ──────────────────────────────────────────────
{
  const { page, context } = await freshPage();
  await page.fill('#itemInput', '사과');
  await page.click('button:has-text("추가")');

  const itemCount = await page.locator('#list li').count();
  const itemName = await page.locator('#list li .name').first().textContent();
  const emptyVisible = await page.locator('#empty').isVisible();
  const inputVal = await page.inputValue('#itemInput');

  assert(itemCount === 1, '아이템 1개 추가됨');
  assert(itemName === '사과', '아이템 이름 "사과" 확인');
  assert(!emptyVisible, '추가 후 빈 상태 문구 숨겨짐');
  assert(inputVal === '', '추가 후 입력창 초기화');
  await context.close();
}

// ──────────────────────────────────────────────
console.log('\n[3] 아이템 추가 - Enter 키');
// ──────────────────────────────────────────────
{
  const { page, context } = await freshPage();
  await page.fill('#itemInput', '바나나');
  await page.press('#itemInput', 'Enter');

  const itemCount = await page.locator('#list li').count();
  const itemName = await page.locator('#list li .name').first().textContent();

  assert(itemCount === 1, 'Enter 키로 아이템 추가됨');
  assert(itemName === '바나나', '"바나나" 이름 확인');
  await context.close();
}

// ──────────────────────────────────────────────
console.log('\n[4] 공백 입력 무시');
// ──────────────────────────────────────────────
{
  const { page, context } = await freshPage();
  await page.fill('#itemInput', '   ');
  await page.click('button:has-text("추가")');
  assert(await page.locator('#list li').count() === 0, '공백만 입력 시 추가 안 됨');

  await page.fill('#itemInput', '');
  await page.click('button:has-text("추가")');
  assert(await page.locator('#list li').count() === 0, '빈 입력 시 추가 안 됨');
  await context.close();
}

// ──────────────────────────────────────────────
console.log('\n[5] 여러 아이템 추가');
// ──────────────────────────────────────────────
{
  const { page, context } = await freshPage();
  for (const name of ['사과', '바나나', '딸기']) {
    await page.fill('#itemInput', name);
    await page.click('button:has-text("추가")');
  }
  const count = await page.locator('#list li').count();
  const names = await page.locator('#list li .name').allTextContents();

  assert(count === 3, '3개 아이템 추가됨');
  assert(JSON.stringify(names) === JSON.stringify(['사과', '바나나', '딸기']), '추가 순서 유지');
  await context.close();
}

// ──────────────────────────────────────────────
console.log('\n[6] 아이템 체크');
// ──────────────────────────────────────────────
{
  const { page, context } = await freshPage();
  await page.fill('#itemInput', '사과');
  await page.click('button:has-text("추가")');

  const checkbox = page.locator('#list li input[type="checkbox"]').first();

  // 체크
  await checkbox.click();
  const checkedClass = await page.locator('#list li').first().getAttribute('class');
  const isChecked = await page.locator('#list li input[type="checkbox"]').first().isChecked();
  assert(checkedClass?.includes('checked'), 'checked 클래스 추가됨');
  assert(isChecked, '체크박스 checked 상태');

  // 체크 해제
  await page.locator('#list li input[type="checkbox"]').first().click();
  const uncheckedClass = await page.locator('#list li').first().getAttribute('class');
  const isUnchecked = !(await page.locator('#list li input[type="checkbox"]').first().isChecked());
  assert(!uncheckedClass?.includes('checked'), 'checked 클래스 제거됨');
  assert(isUnchecked, '체크박스 unchecked 상태');
  await context.close();
}

// ──────────────────────────────────────────────
console.log('\n[7] 아이템 삭제');
// ──────────────────────────────────────────────
{
  const { page, context } = await freshPage();
  for (const name of ['사과', '바나나', '딸기']) {
    await page.fill('#itemInput', name);
    await page.click('button:has-text("추가")');
  }

  // 두 번째 아이템(바나나) 삭제
  await page.locator('#list li .delete').nth(1).click();

  const remaining = await page.locator('#list li .name').allTextContents();
  assert(remaining.length === 2, '삭제 후 2개 남음');
  assert(!remaining.includes('바나나'), '"바나나" 삭제됨');
  assert(remaining.includes('사과') && remaining.includes('딸기'), '나머지 아이템 유지');
  await context.close();
}

// ──────────────────────────────────────────────
console.log('\n[8] 전체 삭제 후 빈 상태 복귀');
// ──────────────────────────────────────────────
{
  const { page, context } = await freshPage();
  for (const name of ['사과', '바나나']) {
    await page.fill('#itemInput', name);
    await page.click('button:has-text("추가")');
  }

  await page.locator('#list li .delete').first().click();
  await page.locator('#list li .delete').first().click();

  const count = await page.locator('#list li').count();
  const emptyVisible = await page.locator('#empty').isVisible();
  assert(count === 0, '전체 삭제 후 아이템 0개');
  assert(emptyVisible, '빈 상태 문구 다시 표시');
  await context.close();
}

// ──────────────────────────────────────────────
console.log('\n[9] localStorage 저장');
// ──────────────────────────────────────────────
{
  const { page, context } = await freshPage();
  await page.fill('#itemInput', '사과');
  await page.click('button:has-text("추가")');

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('shopping') || '[]')
  );
  assert(stored.length === 1, 'localStorage에 1개 저장됨');
  assert(stored[0].name === '사과', 'localStorage 아이템 이름 확인');
  assert(stored[0].checked === false, 'localStorage checked 초기값 false');

  // 체크 후 저장 확인
  await page.locator('#list li input[type="checkbox"]').first().click();
  const stored2 = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('shopping') || '[]')
  );
  assert(stored2[0].checked === true, '체크 후 localStorage 상태 업데이트');
  await context.close();
}

await browser.close();

// ──────────────────────────────────────────────
console.log('\n결과');
console.log('──────────────────────────────────');
console.log(`통과: ${passed}  실패: ${failed}`);
if (failed === 0) {
  console.log('모든 테스트를 통과했습니다.');
  process.exit(0);
} else {
  console.log(`${failed}개 테스트가 실패했습니다.`);
  process.exit(1);
}
