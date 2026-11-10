// Learner journey: landing → sign-in → onboarding → course reader → practice → Nardouch → Visual Lab → progress.
import { BASE, USERS, click, courseId, exitDeepFocus, glide, login, newUserPage, reveal, scrollBy, sleep, type } from '../lib/app.mjs';

export const DB_COURSE = 'Relational Database Design & Normalization';

/** Signs in off camera and opens `path`. */
async function ready(browser, email, path) {
  const page = await newUserPage(browser);
  await page.goto(`${BASE}/login`);
  await login(page, email, { slow: false });
  if (path !== '/dashboard') await page.goto(`${BASE}${path}`);
  await page.waitForLoadState('networkidle').catch(() => {});
  return page;
}

export async function landing({ browser, tl, record, check }) {
  const page = await newUserPage(browser);
  await page.goto(`${BASE}/`);
  await page.waitForLoadState('networkidle');
  await sleep(600);
  await record(page, 'main');
  tl.section('landing');
  tl.caption('Noveris: a GenAI peer-learning companion for university courses');
  await glide(page, 520, 330, 900);
  await sleep(2200);
  await click(page, page.getByRole('link', { name: /^Log in/i }).first());
  await page.waitForURL('**/login');
  tl.section('login');
  tl.caption('Tasnim, a learner, signs in');
  tl.speed(2.5);
  await login(page, USERS.learner);
  tl.speed(1);
  tl.section('dashboard');
  tl.caption('One workspace: courses, tasks, study rooms and progress');
  await page.getByRole('heading', { name: 'Overview' }).waitFor();
  await sleep(700);
  await glide(page, 660, 500, 700);
  await glide(page, 980, 500, 700);
  await sleep(1600);
  await check(page, 'dashboard');
}

export async function onboarding({ browser, tl, record, check }) {
  const page = await ready(browser, USERS.learner, '/dashboard');
  await record(page, 'main');
  tl.section('onboarding');
  tl.caption('Short onboarding: goals, level, language and how they like to learn');
  await click(page, page.getByRole('link', { name: 'Set up my learning' }).first());
  await page.getByRole('heading', { name: 'Set up your learning' }).waitFor();
  tl.speed(1.6);
  const pick = (text) => click(page, page.getByText(text, { exact: true }).first());
  const next = () => click(page, page.getByRole('button', { name: 'Next', exact: true }));
  await pick('Understand difficult concepts');
  await pick('Study with classmates');
  await next();
  await sleep(500);
  await check(page, 'step2');
  const subject = page.getByPlaceholder('Linear algebra, organic chemistry');
  if (await subject.isVisible().catch(() => false)) await type(page, subject, 'Databases', 40);
  await pick('Beginner');
  await next();
  await sleep(500);
  await check(page, 'step3');
  await pick('Visual explanations');
  await pick('Step-by-step explanations');
  await next();
  await sleep(500);
  await check(page, 'step4');
  await pick('Evening');
  await pick('A mix of both');
  await click(page, page.getByRole('button', { name: /^(Finish|Save preferences)$/ }));
  await page.waitForURL((url) => !url.pathname.startsWith('/onboarding'), { timeout: 15000 }).catch(() => {});
  tl.speed(1);
  await sleep(1500);
  await check(page, 'after');
}

/** Learn page with Deep Focus closed, scrolled to the reader. */
async function openReader(page, { visible }) {
  if (visible) {
    await click(page, page.getByRole('link', { name: 'My Learning' }).first());
    await page.waitForURL('**/courses');
    await sleep(600);
    await click(page, page.getByRole('link', { name: new RegExp(DB_COURSE.replace(/[&]/g, '.')) }).first());
    await page.waitForURL(/\/courses\/[^/]+$/);
    await sleep(900);
  }
}

export async function reader({ browser, tl, record, check, log }) {
  const id = courseId('Relational Database');
  const page = await ready(browser, USERS.learner, '/dashboard');
  await record(page, 'main');
  tl.section('course');
  tl.caption('Courses come from the instructor’s own material');
  await openReader(page, { visible: true });
  await check(page, 'course');
  const learn = page.getByRole('link', { name: /Open course|Read|Start learning|Continue/i }).first();
  if (await learn.isVisible().catch(() => false)) await click(page, learn);
  else await page.goto(`${BASE}/courses/${id}/learn`);
  await page.waitForURL('**/learn**');
  await page.getByRole('button', { name: 'Explain simply' }).waitFor();
  tl.section('focus');
  tl.caption('Deep Focus starts automatically and counts active study time');
  await sleep(2200);
  await exitDeepFocus(page);
  await sleep(500);
  tl.section('tutor');
  tl.caption('Stuck on a step? Ask for a simpler explanation');
  await reveal(page.getByRole('button', { name: 'Explain simply' }));
  await sleep(500);
  await click(page, page.getByRole('button', { name: 'Explain simply' }));
  tl.caption('Compact model for a short task. The screen shows progress while it works');
  tl.speed(3);
  await page.getByText('Sources', { exact: true }).first().waitFor({ timeout: 90000 });
  tl.speed(1);
  tl.caption('Grounded in the course, with sources checked against the document');
  log('explain simply answered');
  await sleep(600);
  await reveal(page.getByText('Sources', { exact: true }).first(), 'end');
  await sleep(3800);
  await check(page, 'explained');
  tl.section('fallback');
  tl.caption('When the usage limit is reached, the learner is told and gets labelled guidance');
  await click(page, page.getByRole('button', { name: 'Another example' }));
  tl.speed(3);
  await page.getByText(/Built-in guidance/i).last().waitFor({ timeout: 60000 });
  tl.speed(1);
  log('fallback shown');
  await reveal(page.getByText(/Built-in guidance/i).last());
  await sleep(3500);
  await check(page, 'fallback');
  tl.section('understood');
  tl.caption('Completing lessons grows Nardouch, the course companion');
  await click(page, page.getByRole('button', { name: 'Mark as understood' }));
  await sleep(700);
  await reveal(page.getByText('Your companion for this course'));
  await click(page, page.getByRole('button', { name: 'Complete lesson' }));
  await sleep(2600);
  await check(page, 'understood');
}

export async function practice({ browser, tl, record, check, log }) {
  const id = courseId('Relational Database');
  const page = await ready(browser, USERS.learner, `/courses/${id}/learn`);
  await exitDeepFocus(page);
  await sleep(400);
  await record(page, 'main');
  tl.section('start');
  tl.caption('Practice: reviewed activities picked for the next objective');
  await click(page, page.getByRole('link', { name: /Practice\s*Feedback and the tutor/ }));
  await page.waitForURL(/practice-and-tutor/);
  await page.waitForLoadState('networkidle').catch(() => {});
  await sleep(1200);
  await click(page, page.getByRole('button', { name: 'Start practice' }));
  const quiz = page.getByText('1NF Decomposition Challenge').filter({ visible: true }).first();
  await quiz.waitFor();
  await reveal(quiz, 'start');
  await sleep(1200);
  await check(page, 'quiz');
  tl.section('attempt');
  tl.caption('A first attempt, with one mistake');
  await click(page, page.getByText(/Enrollment\(StudentID, CourseCode, Semester\)/).first());
  await click(page, page.getByText(/Order\(OrderID, CustomerName, ItemsCommaSeparated\)/).first());
  await click(page, page.getByRole('button', { name: 'Submit Answer' }));
  await sleep(1800);
  await check(page, 'feedback');
  tl.caption('Private feedback: what is right, what is not, never the answer key');
  await sleep(2500);
  tl.section('style');
  tl.caption('Six quick questions: how does this learner like hints?');
  const probe = page.getByText('Match hints to how you learn (optional)');
  await click(page, probe);
  await sleep(600);
  const retake = page.getByRole('button', { name: 'Retake' });
  if (await retake.isVisible().catch(() => false)) await click(page, retake); // earlier take saved a style
  tl.speed(2.5);
  const groups = page.locator('fieldset:has(input[name^="style-"])');
  const n = await groups.count();
  for (let i = 0; i < n; i++) {
    const option = groups.nth(i).locator('label').first();
    await click(page, option, { pause: 60 });
  }
  await click(page, page.getByRole('button', { name: 'Save hint style' }));
  tl.speed(1);
  await page.getByText(/Hints currently lean on/).waitFor();
  await reveal(page.getByText(/Hints currently lean on/));
  await sleep(1800);
  await check(page, 'style');
  tl.section('hints');
  tl.caption('Hints before answers, worded for that style and taken from the course source');
  await click(page, page.getByRole('button', { name: 'Request source hint' }));
  await sleep(2500);
  await check(page, 'hint1');
  log('hint shown');
  await sleep(2500);
  tl.section('retry');
  tl.caption('With the hint, a second attempt: correct, and recorded as private evidence');
  await click(page, page.getByRole('button', { name: 'Try Again' }));
  await sleep(700);
  await answerQuiz(page, page.locator('body'));
  await click(page, page.getByRole('button', { name: 'Submit Answer' }));
  await page.getByText(/Correct|Score: 100%/).first().waitFor();
  await reveal(page.getByText(/Correct|Score: 100%/).first());
  await sleep(3200);
  await check(page, 'correct');
}

const RIGHT = [/Student\(StudentID, FullName, CourseCodes\[Array\]\)/, /Order\(OrderID, CustomerName, ItemsCommaSeparated\)/];
const WRONG = [/Enrollment\(StudentID, CourseCode, Semester\)/];

/** Selects exactly the two 1NF violations inside `scope` (quiz options toggle). */
export async function answerQuiz(page, scope) {
  for (const [pattern, want] of [...RIGHT.map((p) => [p, true]), ...WRONG.map((p) => [p, false])]) {
    const option = scope.getByText(pattern).filter({ visible: true }).last();
    const selected = await option.evaluate((el) => /Selected/.test(el.closest('button,label,li,div')?.innerText || ''));
    if (selected !== want) await click(page, option, { pause: 80 });
  }
}

export async function nardouch({ browser, tl, record, check, log }) {
  const id = courseId('Relational Database');
  const page = await ready(browser, USERS.learner, `/courses/${id}/learn`);
  await exitDeepFocus(page);
  const box = page.getByLabel('Your question or answer');
  await box.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await sleep(400);
  await record(page, 'main');
  tl.section('ask');
  tl.caption('Nardouch, the course companion, speaks Darija, French and English');
  tl.speed(2);
  await type(page, box, 'Ya Nardouch, mafhemtech 3lech el valeur lazem tkoun atomique fi 1NF?', 30);
  tl.speed(1);
  await click(page, page.getByRole('button', { name: /Ask Nardouch/i }));
  tl.caption('Capable model for reasoning in the learner’s language');
  tl.speed(4);
  const answer = page.locator('[data-testid="nardouch-answer"], article').last();
  await page.waitForFunction(() => /\[doc:|Sources|Source/.test(document.querySelector('main')?.innerText.split('Ask Nardouch')[1] || ''), null, { timeout: 120000 }).catch(() => {});
  tl.speed(1);
  log('nardouch answered');
  tl.section('answer');
  tl.caption('The answer stays grounded in the course and cites it');
  await sleep(500);
  await scrollBy(page, 260);
  await sleep(4500);
  await check(page, 'answer');
  void answer;
}

export async function lab({ browser, tl, record, check, log }) {
  const page = await ready(browser, USERS.learner, '/dashboard');
  await record(page, 'main');
  tl.section('open');
  tl.caption('Visual Lab: explore a concept as an interactive experiment');
  await click(page, page.getByRole('link', { name: /Visual Lab/ }).first());
  await page.getByRole('heading', { name: 'Visual Lab' }).waitFor();
  await exitDeepFocus(page);
  await sleep(1200);
  await check(page, 'lab-home');
  const explore = page.getByRole('button', { name: 'Explore' }).first();
  await click(page, explore);
  tl.caption('The model proposes the scenario. Trusted code computes every number');
  tl.speed(3);
  await page.waitForURL(/\/visual-lab\/[^/]+$/, { timeout: 90000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  tl.speed(1);
  log('lab opened');
  await exitDeepFocus(page);
  await sleep(1500);
  await check(page, 'lab');
  tl.section('interact');
  const slider = page.locator('input[type=range]').first();
  if (await slider.isVisible().catch(() => false)) {
    tl.caption('Change a parameter and the result updates instantly');
    const b = await slider.boundingBox();
    await glide(page, b.x + b.width * 0.3, b.y + b.height / 2);
    await page.mouse.down();
    await glide(page, b.x + b.width * 0.85, b.y + b.height / 2, 1400);
    await page.mouse.up();
    await sleep(1500);
  }
  await scrollBy(page, 420, 1200);
  await sleep(2500);
  await check(page, 'lab-after');
}

export async function progress({ browser, tl, record, check }) {
  const page = await ready(browser, USERS.learner, '/dashboard');
  await record(page, 'main');
  tl.section('progress');
  tl.caption('Progress comes from accepted practice evidence, not from chat');
  await click(page, page.getByRole('link', { name: 'Progress' }).first());
  await page.waitForURL('**/progress');
  await sleep(1800);
  await scrollBy(page, 380, 1100);
  await sleep(2200);
  await check(page, 'progress');
}
