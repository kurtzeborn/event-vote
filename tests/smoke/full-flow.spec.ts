/**
 * Smoke test – Full voting flow
 *
 * Exercises the entire happy-path:
 *   1. Votekeeper signs in (mock auth)
 *   2. Seeds votekeeper if first time
 *   3. Creates an event
 *   4. Adds 3 voting options
 *   5. Opens voting
 *   6. Voter joins on a mobile viewport, enters name, allocates votes
 *   7. Votekeeper closes voting
 *   8. Votekeeper reveals results one-by-one
 *   9. Votekeeper completes the event
 *  10. Public results page loads
 *
 * Prerequisites: the local dev environment must be running
 *   (Azurite + Azure Functions + Vite dev server).
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// ── helpers ──────────────────────────────────────────────────────────────

/** Sign in via the mock auth page and land on the dashboard. */
async function votekeeperSignIn(page: Page) {
  await page.goto('/.auth/login/aad?post_login_redirect_uri=/dashboard');
  await page.getByRole('button', { name: /sign in/i }).click();
  // Dashboard loads, fires /api/me, then shows content or redirects.
  // Wait for either "Create Event" link or "Become First Votekeeper" button.
  await expect(
    page.getByRole('link', { name: /new event/i }).first()
      .or(page.getByRole('button', { name: /become first votekeeper/i }))
  ).toBeVisible({ timeout: 20_000 });
}

/** If the "Become First Votekeeper" button is visible, click it and wait. */
async function seedIfNeeded(page: Page) {
  const seedBtn = page.getByRole('button', { name: /become first votekeeper/i });
  if (await seedBtn.isVisible()) {
    await seedBtn.click();
    // After seeding the page refreshes and shows the dashboard
    await expect(page.getByRole('link', { name: /new event/i }).first()).toBeVisible({ timeout: 15_000 });
  }
}

// ── test ─────────────────────────────────────────────────────────────────

test('create event → vote → reveal → complete', async ({ browser }) => {
  // ── 1. Votekeeper: sign in ──────────────────────────────────────────
  const vkContext = await browser.newContext();
  const vk = await vkContext.newPage();

  await votekeeperSignIn(vk);
  await seedIfNeeded(vk);

  // ── 2. Create event ─────────────────────────────────────────────────
  await vk.getByRole('link', { name: /new event/i }).first().click();
  await vk.waitForURL('**/create');

  await vk.getByLabel(/event name/i).fill('Smoke Test Event');
  await vk.getByRole('button', { name: /create event/i }).click();

  // Land on the manage page – URL contains /manage/<4-letter ID>
  await vk.waitForURL(/\/manage\/[A-Z]{4}$/);
  const eventId = vk.url().match(/\/manage\/([A-Z]{4})$/)?.[1];
  expect(eventId).toBeTruthy();

  // ── 3. Add 3 voting options ─────────────────────────────────────────
  const options = ['Option Alpha', 'Option Beta', 'Option Gamma'];
  for (const title of options) {
    await vk.getByPlaceholder('Option title').fill(title);
    await vk.getByRole('button', { name: 'Add' }).click();
    // Wait for the option to appear in the list
    await expect(vk.getByText(title)).toBeVisible();
  }

  // Verify all 3 options are listed
  await expect(vk.getByText('Voting Options (3)')).toBeVisible();

  // ── 4. Open voting ──────────────────────────────────────────────────
  await vk.getByRole('button', { name: /open voting/i }).click();

  // Status should change
  await expect(vk.getByText(/open/i).first()).toBeVisible();

  // ── 5. Voter: join, enter name, cast votes ──────────────────────────
  const voterContext: BrowserContext = await browser.newContext({
    viewport: { width: 375, height: 812 }, // iPhone-like viewport
  });
  const voter = await voterContext.newPage();

  await voter.goto(`/join/${eventId}`);
  await expect(voter.getByText('Smoke Test Event')).toBeVisible();

  // Enter voter name
  await voter.getByPlaceholder(/enter your name/i).fill('Test Voter');

  // Voting option buttons should appear
  await expect(voter.getByText('Option Alpha')).toBeVisible();

  // Allocate votes: 2 on Alpha, 1 on Gamma (3 total, the default)
  // Use heading-based locator to find each option's + button
  const optionPlus = (name: string) =>
    voter.getByRole('heading', { name }).locator('..').locator('..').getByRole('button', { name: '+' });

  await optionPlus('Option Alpha').click();
  await optionPlus('Option Alpha').click();
  await optionPlus('Option Gamma').click();

  // Verify all votes allocated
  await expect(voter.getByText('All votes allocated!')).toBeVisible();

  // Wait for auto-save (debounce 1.5s + network)
  await expect(voter.getByText('Saving...')).toBeVisible({ timeout: 5_000 });
  await expect(voter.getByText('✓ Saved')).toBeVisible({ timeout: 10_000 });

  // ── 6. Votekeeper: close voting ─────────────────────────────────────
  // Accept the confirm dialog
  vk.on('dialog', (d) => d.accept());
  await vk.getByRole('button', { name: /close voting/i }).click();

  // Status should become 'closed'
  await expect(vk.getByText(/closed/i).first()).toBeVisible({ timeout: 10_000 });

  // ── 7. Reveal results one-by-one ────────────────────────────────────
  // Click "Reveal Results" to start the reveal
  await vk.getByRole('button', { name: /reveal results/i }).click();

  // Now in the reveal view – dark background
  await expect(vk.locator('.bg-gray-900')).toBeVisible({ timeout: 10_000 });

  // Reveal each option (3 options → 2 more "Reveal Next" clicks)
  for (let i = 0; i < 2; i++) {
    const revealNext = vk.getByRole('button', { name: /reveal next/i });
    await expect(revealNext).toBeVisible({ timeout: 10_000 });
    await revealNext.click();
    // Brief wait for animation/network
    await vk.waitForTimeout(500);
  }

  // All revealed – "Complete Event" should appear
  await expect(vk.getByRole('button', { name: /complete event/i })).toBeVisible({ timeout: 10_000 });
  await vk.getByRole('button', { name: /complete event/i }).click();

  // ── 8. Verify final results ─────────────────────────────────────────
  // Wait for "Final Results" label first, then check content
  await expect(vk.getByText('Final Results')).toBeVisible({ timeout: 10_000 });
  await expect(vk.getByRole('heading', { name: 'Option Alpha' }).first()).toBeVisible({ timeout: 10_000 });

  // PDF link should be available
  await expect(vk.getByText('PDF')).toBeVisible();

  // ── 9. Public results page ──────────────────────────────────────────
  const publicPage = await vkContext.newPage();
  await publicPage.goto(`/results/${eventId}`);
  await expect(publicPage.getByText('Smoke Test Event')).toBeVisible({ timeout: 10_000 });
  await expect(publicPage.getByRole('heading', { name: 'Option Alpha' }).first()).toBeVisible();

  // ── Cleanup ─────────────────────────────────────────────────────────
  await voterContext.close();
  await vkContext.close();
});
