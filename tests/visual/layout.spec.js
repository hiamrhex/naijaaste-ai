import { test, expect } from '@playwright/test';

// Geometry assertions, not pixel diffing: these run on every platform in CI.
// They pin the layout defects that screenshots caught during the redesign —
// a stacked tab bar, a clipped composer, a footer floating mid-page, an
// empty agent panel on first load, and cards that overflow their column.

const expectNoHorizontalOverflow = async (page) => {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, 'page must not scroll horizontally').toBeLessThanOrEqual(innerWidth + 1);
};

const boxOf = async (locator, label) => {
  const box = await locator.boundingBox();
  expect(box, `${label} must be laid out`).not.toBeNull();
  return box;
};

const signUp = async (page, viewport) => {
  await page.setViewportSize(viewport);
  await page.goto('/app/signup');
  await page.getByPlaceholder(/ada obi/i).fill('Layout Probe');
  await page
    .getByPlaceholder(/you@example\.com/i)
    .fill(`visual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByPlaceholder(/at least 8 characters/i).fill('Str0ng!Passw0rd!');
  await page.locator('form button[type="submit"]').click();
  await page.getByPlaceholder(/describe yourself/i).waitFor({ timeout: 30000 });
};

const recs = [
  {
    restaurant_id: 'r-amala-spot',
    restaurant_name: 'Amala Spot Yaba',
    location: 'Yaba, Lagos',
    cuisine_tags: ['Yoruba', 'Amala'],
    price_tier: 'budget',
    predicted_rating: 4.6,
    spice_level: 4,
    match_score: 0.94,
    reasoning: 'A Yaba institution where a full plate stays under ₦2,000.',
    why_they_will_love_it: 'Real uziza and scent leaf in the pepper soup.',
    potential_concern: 'Lunch queues peak around 1pm.',
    signature_dishes: ['Amala & Ewedu'],
  },
  {
    restaurant_id: 'r-nkwobi-haven',
    restaurant_name: 'Nkwobi Haven',
    location: 'Surulere, Lagos',
    cuisine_tags: ['Igbo', 'Nkwobi'],
    price_tier: 'mid_range',
    predicted_rating: 4.4,
    spice_level: 5,
    match_score: 0.88,
    reasoning: 'Pounded to order and finished with utazi and potash.',
    why_they_will_love_it: 'They will make it as hot as you asked.',
    potential_concern: 'Mostly outdoor seating.',
    signature_dishes: ['Nkwobi'],
  },
  {
    restaurant_id: 'r-suya-republic',
    restaurant_name: 'Suya Republic',
    location: 'Ikeja, Lagos',
    cuisine_tags: ['Hausa', 'Suya'],
    price_tier: 'budget',
    predicted_rating: 4.7,
    spice_level: 4,
    match_score: 0.83,
    reasoning: 'Yaji-forward suya cut thin and grilled hard.',
    why_they_will_love_it: 'You can order by heat level.',
    potential_concern: 'Takeaway only.',
    signature_dishes: ['Beef suya'],
  },
];

const mockAgent = async (page) => {
  await page.route(/\/agent(\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        session_id: '11111111-1111-4111-8111-111111111111',
        stage: 'recommend',
        message: 'Three spots that fit a tight budget and a heavy hand with pepper.',
        extracted_persona: {
          persona_id: '22222222-2222-4222-8222-222222222222',
          full_name: 'Layout Probe',
          city: 'Lagos',
          budget_level: 'budget',
          spice_tolerance: 'extra_hot',
          ambience_preference: 'casual_dining',
          occupation: 'Student',
        },
        recommendations: {
          recommendations: recs,
          meta: { after_hard_filter: 14, candidates_sent_to_llm: 10, latency_ms: 900 },
        },
        meta: { latency_ms: 950, steps: 4, agent: true },
      }),
    });
  });
};

test.describe('landing page layout', () => {
  test('desktop: two-column hero, horizontal nav, no overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const navLinks = page.locator('.nav-links');
    await expect(navLinks).toBeVisible();
    const firstLink = await boxOf(navLinks.locator('a').first(), 'first nav link');
    const secondLink = await boxOf(navLinks.locator('a').nth(1), 'second nav link');
    expect(Math.abs(firstLink.y - secondLink.y)).toBeLessThanOrEqual(2);

    // The hero is a two-column grid at >=900px: copy and visual must not
    // overlap (the class of bug a narrow column causes).
    const copy = await boxOf(page.locator('.hero-copy'), 'hero copy');
    const visual = await boxOf(page.locator('.hero-visual'), 'hero visual');
    expect(copy.x + copy.width).toBeLessThanOrEqual(visual.x + 1);
  });

  test('mobile: stacked hero, no horizontal scroll, readable headline', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.nav-links')).toBeHidden();
    await expectNoHorizontalOverflow(page);

    const fontSize = await page
      .getByRole('heading', { level: 1 })
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(32);

    const cta = await boxOf(page.locator('.cta-row .btn-primary').first(), 'hero CTA');
    expect(cta.x).toBeGreaterThanOrEqual(0);
    expect(cta.x + cta.width).toBeLessThanOrEqual(390 + 1);
  });
});

test.describe('auth layout', () => {
  test('mobile: card fits, tabs share a row, submit is a real touch target', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/login');

    const card = await boxOf(page.getByTestId('auth-card'), 'auth card');
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(390 + 1);
    await expectNoHorizontalOverflow(page);

    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(2);
    const signIn = await boxOf(tabs.nth(0), 'sign-in tab');
    const create = await boxOf(tabs.nth(1), 'create-account tab');
    expect(Math.abs(signIn.y - create.y)).toBeLessThanOrEqual(2);
    expect(create.x).toBeGreaterThan(signIn.x);

    const submit = await boxOf(page.locator('.auth-submit'), 'submit button');
    expect(submit.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('app shell layout', () => {
  test('mobile: composer pinned, footer above it, tab bar horizontal', async ({ page }) => {
    const viewport = { width: 390, height: 844 };
    await signUp(page, viewport);
    await expectNoHorizontalOverflow(page);

    const composer = await boxOf(page.locator('.composer-dock'), 'composer');
    expect(composer.y + composer.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(composer.height).toBeGreaterThan(40);

    // The textarea was clipped to 30px by its own maxHeight/minHeight before.
    const input = await boxOf(page.locator('#chat-input'), 'composer textarea');
    expect(input.height).toBeGreaterThanOrEqual(30);
    expect(input.y + input.height).toBeLessThanOrEqual(composer.y + composer.height + 1);

    // Short conversations must not leave the footer floating mid-screen.
    // Hide the tall content, then the footer should still sit at the bottom of
    // the scroll area (margin-top:auto), just above the composer — not in the
    // middle of a blank page as it did before.
    await page.addStyleTag({ content: '.hero, .quick-menu { display: none !important; }' });
    await page.locator('.home-scroll').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const footer = await boxOf(page.locator('.home-foot'), 'footer');
    expect(footer.y + footer.height).toBeLessThanOrEqual(composer.y + 1);
    expect(composer.y - (footer.y + footer.height)).toBeLessThanOrEqual(60);

    // Fresh chat: the agent panel is hidden until there is work to show.
    await expect(page.getByText('What the agent did')).toHaveCount(0);

    const tabs = page.locator('.tabbar-content a.tab-link');
    await expect(tabs).toHaveCount(6);
    const first = await boxOf(tabs.nth(0), 'first tab');
    const second = await boxOf(tabs.nth(1), 'second tab');
    const last = await boxOf(tabs.nth(5), 'last tab');
    expect(Math.abs(first.y - second.y)).toBeLessThanOrEqual(2);
    expect(second.x).toBeGreaterThan(first.x);
    expect(last.x + last.width).toBeLessThanOrEqual(viewport.width + 1);

    const tabbar = await boxOf(page.locator('.tabbar'), 'tab bar');
    expect(tabbar.y + tabbar.height).toBeLessThanOrEqual(viewport.height + 1);
  });

  test('results: cards stay in-column, show a monogram plate and a rank', async ({ page }) => {
    const viewport = { width: 390, height: 844 };
    await signUp(page, viewport);
    await mockAgent(page);

    await page.getByPlaceholder(/describe yourself/i).fill('Student in Lagos, love pepper soup, tight budget');
    await page.getByRole('button', { name: /send message/i }).click();
    await expect(page.getByText(/spots worth eating at/i)).toBeVisible({ timeout: 30000 });

    const cards = page.locator('.result-card');
    await expect(cards).toHaveCount(3);

    for (let i = 0; i < 3; i++) {
      const card = await boxOf(cards.nth(i), `result card ${i + 1}`);
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(viewport.width + 1);
    }

    await expectNoHorizontalOverflow(page);
    await expect(cards.first().locator('.rank-stamp')).toHaveText('1');
    await expect(cards.first().locator('.match-pill')).toContainText('94');

    // No emoji art: the fallback is the plate monogram.
    const monogram = cards.first().locator('.plate-initial');
    await expect(monogram).toHaveText(/^[A-Z]{1,3}$/);
    await expect(cards.first().getByRole('button', { name: /review/i })).toBeVisible();
  });
});
