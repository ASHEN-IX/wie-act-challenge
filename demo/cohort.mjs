// Gives the synthetic class real practice evidence by completing the 1NF quiz through the UI
// (not recorded). Instructor insights then summarise genuine, privacy-thresholded data.
// Usage: node demo/cohort.mjs [count=6]   (after demo/reset.sh, which seeds class01..class12)
import { BASE, PASSWORD, courseId, exitDeepFocus, launch, newUserPage } from './lib/app.mjs';

const count = Number(process.argv[2] || 6);
const id = courseId('Relational Database');
const browser = await launch();
let done = 0;
for (let i = 1, tries = 1; i <= count; i++) {
  const email = `class${String(i).padStart(2, '0')}@ednova.test`;
  const page = await newUserPage(browser, { width: 1280, height: 720, scale: 1 });
  try {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', PASSWORD);
    await page.keyboard.press('Enter');
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    await page.goto(`${BASE}/courses/${id}/learn#practice-and-tutor`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await exitDeepFocus(page);
    await page.getByRole('button', { name: 'Start practice' }).click();
    await page.getByText(/Student\(StudentID, FullName, CourseCodes\[Array\]\)/).filter({ visible: true }).last().click();
    await page.getByText(/Order\(OrderID, CustomerName, ItemsCommaSeparated\)/).filter({ visible: true }).last().click();
    await page.getByRole('button', { name: 'Submit Answer' }).click();
    await page.getByText(/Correct|Score: 100%/).first().waitFor({ timeout: 30000 });
    done++;
    console.log(`  ✓ ${email} practised`);
    tries = 1;
  } catch (error) {
    console.error(`  ✖ ${email} (try ${tries}): ${error.message.split('\n')[0]}`);
    if (tries++ < 2) i--; // one retry per learner
    else tries = 1;
  } finally {
    await page.context().close();
  }
}
await browser.close();
console.log(`cohort practice: ${done}/${count}`);
process.exit(done === count ? 0 : 1);
