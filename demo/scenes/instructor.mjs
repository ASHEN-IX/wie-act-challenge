// Instructor journey: teaching workspace → Course Studio → privacy-thresholded insights → upload.
import { BASE, USERS, click, login, newUserPage, scrollBy, sleep } from '../lib/app.mjs';
import { DB_COURSE } from './learner.mjs';

export async function instructor({ browser, tl, record, check }) {
  const page = await newUserPage(browser);
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await record(page, 'main');
  tl.section('login');
  tl.caption('The instructor signs in to the teaching workspace');
  tl.speed(3);
  await login(page, USERS.instructor);
  tl.speed(1);
  await page.getByRole('heading', { name: 'Teaching workspace' }).waitFor();
  tl.section('workspace');
  tl.caption('Instructors upload their own material, review it and publish it');
  await sleep(2200);
  await check(page, 'workspace');

  tl.section('studio');
  tl.caption('Course Studio: access, automated review and versioned publishing');
  await click(page, page.getByRole('link', { name: new RegExp(DB_COURSE.replace(/&/g, '.')) }).first());
  await page.waitForURL('**/studio');
  await sleep(1800);
  await scrollBy(page, 420, 1200);
  await sleep(1800);
  await check(page, 'studio');

  tl.section('privacy');
  tl.caption('Small classes stay hidden: no figure is shown for fewer than five learners');
  await click(page, page.getByRole('link', { name: 'Instructor insights' }).first());
  await page.waitForURL('**/instructor-insights**');
  await page.getByText('Insights are not available yet').waitFor();
  await sleep(2800);
  await check(page, 'privacy');

  tl.section('insights');
  tl.caption('Instructor insights: class-level practice, never private answers or chats');
  await page.locator('select[name=courseId]').selectOption({ label: DB_COURSE });
  await click(page, page.getByRole('button', { name: 'Show course insights' }));
  await page.getByText('Active enrolled learners').waitFor();
  await sleep(1800);
  await scrollBy(page, 360, 1200);
  await sleep(2800);
  await check(page, 'insights');

  tl.section('upload');
  tl.caption('New material goes through upload, OCR and review before learners see it');
  await click(page, page.getByRole('link', { name: 'Home' }).first());
  await click(page, page.getByRole('link', { name: 'Upload course' }).first());
  await page.waitForURL('**/courses/new');
  await page.getByRole('heading', { name: 'Upload course material' }).waitFor();
  await sleep(2800);
  await check(page, 'upload');
}
