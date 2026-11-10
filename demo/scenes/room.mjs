// Study Together with two real, simultaneous browser sessions shown side by side.
import { BASE, USERS, click, glide, login, newUserPage, sleep, type } from '../lib/app.mjs';
import { DB_COURSE, answerQuiz } from './learner.mjs';

const PANE = { width: 1024, height: 900, scale: 1.5 };

async function signedIn(browser, email) {
  const page = await newUserPage(browser, PANE);
  await page.goto(`${BASE}/login`);
  await login(page, email, { slow: false });
  await page.goto(`${BASE}/study-together`);
  await page.waitForLoadState('networkidle').catch(() => {});
  return page;
}

const TOOLS = { r: 'rectangle', a: 'arrow', t: 'text' };
// The test id is on a visually hidden radio; its label is the visible button.
const toolButton = (page, name) => page.locator('.excalidraw label').filter({ has: page.getByTestId(`toolbar-${name}`) });

/** Draws by picking Excalidraw's toolbar tool (visible to viewers), then dragging. */
async function draw(page, shape, from, to, text) {
  const canvas = page.locator('.excalidraw canvas.interactive');
  const box = await canvas.boundingBox();
  const at = ([x, y]) => [box.x + box.width * x, box.y + box.height * y];
  await click(page, toolButton(page, TOOLS[shape]), { reveal: false });
  const [x1, y1] = at(from);
  await glide(page, x1, y1, 350);
  await page.mouse.down();
  const [x2, y2] = at(to);
  await glide(page, x2, y2, 650);
  await page.mouse.up();
  if (text) {
    await click(page, toolButton(page, 'text'), { reveal: false });
    const [tx, ty] = at([from[0] + 0.03, from[1] + 0.05]);
    await glide(page, tx, ty, 300);
    await page.mouse.click(tx, ty);
    await sleep(300); // the text editor mounts after the click
    await page.keyboard.type(text, { delay: 35 });
    await page.keyboard.press('Escape');
  }
  await page.keyboard.press('Escape');
}

export async function room({ browser, tl, record, check, log }) {
  const [left, right] = await Promise.all([signedIn(browser, USERS.learner), signedIn(browser, USERS.peer)]);
  await record(left, 'left');
  await record(right, 'right');

  tl.section('create');
  tl.caption('Study Together: two real browser sessions, Tasnim (left) and Aziz (right)');
  await sleep(1500);
  await left.locator('select').first().selectOption({ label: DB_COURSE });
  const known = await left.locator('a[href^="/study-together/"]').evaluateAll((a) => a.map((x) => x.getAttribute('href')));
  await click(left, left.getByRole('button', { name: 'Create room' }));
  // Open the room just created (earlier takes may have left others); read its invite code inside.
  await left.waitForFunction(
    (old) => [...document.querySelectorAll('a')].some((a) => a.textContent.trim() === 'Open room' && !old.includes(a.getAttribute('href'))),
    known,
  );
  const href = await left.locator('a', { hasText: 'Open room' }).evaluateAll(
    (links, old) => links.map((a) => a.getAttribute('href')).find((h) => !old.includes(h)),
    known,
  );
  const openLink = left.locator(`a[href="${href}"]`).filter({ hasText: 'Open room' }).first();
  await sleep(800);
  await click(left, openLink);
  await left.getByRole('button', { name: 'Start Peer Discussion' }).waitFor();
  const invite = (await left.getByTestId('invite-code').innerText()).trim();
  log(`room opened, invite ${invite}`);
  tl.caption('Deep Focus keeps the room distraction-free; the invite code is shared with the group');
  await sleep(2200);

  tl.section('join');
  tl.caption('Aziz joins with the invite code');
  await type(right, right.getByLabel('Invite code'), invite, 60);
  await click(right, right.getByRole('button', { name: 'Join room' }));
  const rightOpen = right.getByRole('link', { name: 'Open room' }).first();
  await rightOpen.waitFor();
  await click(right, rightOpen);
  await right.waitForURL('**/study-together/*');
  await right.getByText(/Room Members/).first().waitFor();
  await left.getByText(/Aziz/).first().waitFor();
  tl.caption('Both members are online in the same room, in real time');
  await sleep(2600);
  await check(left, 'joined-left');
  await check(right, 'joined-right');

  tl.section('discuss');
  tl.caption('Tasnim, the presenter, opens the peer discussion');
  await click(left, left.getByRole('button', { name: 'Start Peer Discussion' }));
  await sleep(1500);

  tl.section('chat');
  tl.caption('Peer discussion syncs instantly on both screens');
  tl.speed(1.6);
  await type(left, left.getByLabel('Message to room'), 'I think a column holding several course codes breaks 1NF?', 22);
  await click(left, left.getByRole('button', { name: 'Send message' }));
  await right.getByText('several course codes').first().waitFor();
  await type(right, right.getByLabel('Message to room'), 'Yes! We should split it into a StudentCourse table.', 22);
  await click(right, right.getByRole('button', { name: 'Send message' }));
  await left.getByText('StudentCourse table').first().waitFor();
  tl.speed(1);
  await sleep(1800);
  await check(left, 'chat-left');

  tl.section('board');
  tl.caption('A shared whiteboard: both peers sketch the decomposition together');
  await click(left, left.getByRole('button', { name: 'Whiteboard' }));
  await click(right, right.getByRole('button', { name: 'Whiteboard' }));
  await left.locator('.excalidraw canvas.interactive').waitFor({ timeout: 30000 });
  await right.locator('.excalidraw canvas.interactive').waitFor({ timeout: 30000 });
  await sleep(1200);
  tl.speed(1.5);
  await draw(left, 'r', [0.06, 0.18], [0.42, 0.45], 'Codes[ ] ✗');
  await sleep(1200);
  await draw(right, 'a', [0.44, 0.31], [0.56, 0.31]);
  await draw(right, 'r', [0.58, 0.18], [0.94, 0.45], '1 code/row ✓');
  tl.speed(1);
  await sleep(2500);
  await check(left, 'board-left');
  await check(right, 'board-right');
  await click(left, left.getByRole('button', { name: 'Activity', exact: true }));
  await click(right, right.getByRole('button', { name: 'Activity', exact: true }));

  tl.section('facilitator');
  tl.caption('Ask the AI facilitator: it is peer-first, it asks and hints before it explains');
  await click(left, left.getByRole('tab', { name: /Help/ }));
  await type(left, left.getByLabel('Ask the AI facilitator'), 'Why does a list of codes in one column break 1NF?', 22);
  await click(left, left.getByRole('button', { name: 'Ask AI' }));
  tl.speed(3);
  await left.getByText(/AI-generated guidance|Built-in guidance|Test guidance/).first().waitFor({ timeout: 90000 });
  tl.speed(1);
  log('facilitator guidance shown');
  await sleep(5000);
  await check(left, 'facilitator');

  tl.section('attempt');
  tl.caption('Then a reviewed activity: everyone answers privately first');
  await click(left, left.getByRole('tab', { name: /Chat/ }));
  const activity = left.getByLabel('Reviewed room activity');
  const value = await activity.evaluate((el) => [...el.options].find((o) => /1NF Decomposition/.test(o.text))?.value || el.options[1].value);
  await click(left, activity);
  await activity.selectOption(value);
  await click(left, left.getByRole('button', { name: 'Start selected activity' }));
  for (const page of [right, left]) {
    await page.getByRole('button', { name: 'Submit Answer' }).last().waitFor({ timeout: 30000 });
  }
  await sleep(1200);
  await check(left, 'attempt-left');
  await check(right, 'attempt-right');
  tl.speed(1.5);
  for (const page of [right, left]) {
    const quiz = page.locator('[data-testid="room-learning"]');
    await answerQuiz(page, quiz);
    await click(page, quiz.getByRole('button', { name: 'Submit Answer' }).last());
    await sleep(1500);
  }
  tl.speed(1);
  tl.caption('The presenter sees who has submitted, never what they answered');
  await sleep(3500);
  await check(left, 'submitted-left');

  tl.section('debrief');
  tl.caption('Debrief: a shared recap, with each learner’s feedback kept private');
  await click(left, left.getByRole('button', { name: 'Move to Debrief' }));
  await sleep(3500);
  await check(left, 'debrief-left');
  await check(right, 'debrief-right');
  return 'split';
}
