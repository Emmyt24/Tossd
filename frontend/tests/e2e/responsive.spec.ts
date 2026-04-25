import { test, expect, type Locator, type Page } from "@playwright/test";

const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
} as const;

const ORIENTATIONS = {
  mobile: {
    portrait: { width: 375, height: 812 },
    landscape: { width: 812, height: 375 },
  },
  tablet: {
    portrait: { width: 768, height: 1024 },
    landscape: { width: 1024, height: 768 },
  },
  desktop: {
    portrait: { width: 900, height: 1440 },
    landscape: { width: 1440, height: 900 },
  },
} as const;

type LayoutMode = "stacked" | "split";
type NavMode = "mobile" | "desktop";

function primaryNav(page: Page) {
  return page.getByRole("navigation", { name: /primary navigation/i });
}

function mobileMenuTrigger(page: Page) {
  return page.getByRole("button", { name: /open navigation menu/i });
}

async function loadHome(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

async function resize(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(100);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectNavMode(page: Page, mode: NavMode) {
  if (mode === "mobile") {
    await expect(mobileMenuTrigger(page)).toBeVisible();
    await expect(primaryNav(page)).toBeHidden();
    return;
  }

  await expect(primaryNav(page)).toBeVisible();
  await expect(mobileMenuTrigger(page)).toBeHidden();
}

async function expectPlayGridLayout(page: Page, mode: LayoutMode) {
  await page.locator("#play").scrollIntoViewIfNeeded();

  const playPanel = page.locator(".playPanel");
  const statusPanel = page.locator(".statusPanel");

  await expect(playPanel).toBeVisible();
  await expect(statusPanel).toBeVisible();

  const playBox = await playPanel.boundingBox();
  const statusBox = await statusPanel.boundingBox();

  expect(playBox).not.toBeNull();
  expect(statusBox).not.toBeNull();

  if (!playBox || !statusBox) {
    return;
  }

  if (mode === "stacked") {
    expect(Math.abs(playBox.x - statusBox.x)).toBeLessThanOrEqual(4);
    expect(statusBox.y).toBeGreaterThan(playBox.y + playBox.height - 1);
    return;
  }

  expect(statusBox.x).toBeGreaterThan(playBox.x + playBox.width - 1);
  expect(Math.abs(playBox.y - statusBox.y)).toBeLessThanOrEqual(8);
}

async function expectMinimumTouchTarget(locator: Locator, label: string) {
  const box = await locator.boundingBox();

  expect(box, `${label} should have a measurable bounding box`).not.toBeNull();

  if (!box) {
    return;
  }

  expect(box.width, `${label} should be at least 44px wide`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${label} should be at least 44px tall`).toBeGreaterThanOrEqual(44);
}

test.describe("Responsive layout matrix @e2e", () => {
  const expectations = {
    mobile: { nav: "mobile" as const, layout: "stacked" as const },
    tablet: { nav: "mobile" as const, layout: "stacked" as const },
    desktop: { nav: "desktop" as const, layout: "split" as const },
  };

  for (const [device, viewport] of Object.entries(VIEWPORTS) as Array<
    [keyof typeof VIEWPORTS, (typeof VIEWPORTS)[keyof typeof VIEWPORTS]]
  >) {
    test(`${device}: landing page stays usable across the target viewport @e2e`, async ({ page }) => {
      await loadHome(page, viewport);

      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.locator("[aria-label='Hero']")).toBeVisible();
      await expect(page.locator("#play")).toBeVisible();
      await expect(page.locator("footer[aria-label='Site footer']")).toBeVisible();

      await expectNavMode(page, expectations[device].nav);
      await expectPlayGridLayout(page, expectations[device].layout);
      await expectNoHorizontalOverflow(page);
    });
  }
});

test.describe("Breakpoint transitions @e2e", () => {
  test("768px and 769px swap navigation modes cleanly @e2e", async ({ page }) => {
    await loadHome(page, { width: 768, height: 1024 });
    await expectNavMode(page, "mobile");

    await resize(page, { width: 769, height: 1024 });
    await expectNavMode(page, "desktop");
    await expectNoHorizontalOverflow(page);
  });

  test("900px and 901px swap the play grid layout cleanly @e2e", async ({ page }) => {
    await loadHome(page, { width: 900, height: 900 });
    await expectPlayGridLayout(page, "stacked");

    await resize(page, { width: 901, height: 900 });
    await expectPlayGridLayout(page, "split");
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Orientation changes @e2e", () => {
  const orientationExpectations = {
    mobile: {
      portrait: { nav: "mobile" as const, layout: "stacked" as const },
      landscape: { nav: "desktop" as const, layout: "stacked" as const },
    },
    tablet: {
      portrait: { nav: "mobile" as const, layout: "stacked" as const },
      landscape: { nav: "desktop" as const, layout: "split" as const },
    },
    desktop: {
      portrait: { nav: "desktop" as const, layout: "stacked" as const },
      landscape: { nav: "desktop" as const, layout: "split" as const },
    },
  };

  for (const [device, viewports] of Object.entries(ORIENTATIONS) as Array<
    [keyof typeof ORIENTATIONS, (typeof ORIENTATIONS)[keyof typeof ORIENTATIONS]]
  >) {
    test(`${device}: portrait and landscape stay responsive after rotation @e2e`, async ({ page }) => {
      await loadHome(page, viewports.portrait);

      await expectNavMode(page, orientationExpectations[device].portrait.nav);
      await expectPlayGridLayout(page, orientationExpectations[device].portrait.layout);

      await resize(page, viewports.landscape);

      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.locator("[aria-label='Hero']")).toBeVisible();
      await expect(page.locator("#play")).toBeVisible();
      await expectNavMode(page, orientationExpectations[device].landscape.nav);
      await expectPlayGridLayout(page, orientationExpectations[device].landscape.layout);
      await expectNoHorizontalOverflow(page);
    });
  }
});

test.describe("Pointer interactions @e2e", () => {
  test("desktop mouse interactions keep primary actions available @e2e", async ({ page }) => {
    await loadHome(page, VIEWPORTS.desktop);

    const connectWallet = page.getByRole("button", { name: /connect wallet/i }).first();

    await expect(connectWallet).toBeVisible();
    await connectWallet.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /close wallet modal/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

});

test.describe("Touch interactions @e2e", () => {
  test.use({ hasTouch: true, viewport: VIEWPORTS.mobile });

  test("mobile controls stay touch-friendly and tappable @e2e", async ({ page }) => {
    await loadHome(page, VIEWPORTS.mobile);

    const menuButton = mobileMenuTrigger(page);
    await expectMinimumTouchTarget(menuButton, "Mobile navigation trigger");

    await menuButton.tap();
    const mobileWalletButton = page.getByRole("button", { name: /connect wallet/i });

    await expect(page.getByRole("dialog", { name: /navigation menu/i })).toBeVisible();
    await expectMinimumTouchTarget(mobileWalletButton, "Mobile wallet button");

    await mobileWalletButton.tap();
    await expect(page.getByRole("dialog", { name: /connect wallet/i })).toBeVisible();

    const freighterButton = page.getByRole("button", { name: /freighter/i });
    await expectMinimumTouchTarget(freighterButton, "Freighter wallet option");
    await freighterButton.tap();

    await expect(page.getByText(/connected/i)).toBeVisible({ timeout: 3_000 });
  });
});

test.describe("Responsive media strategy @e2e", () => {
  test("landing page currently uses layout responsiveness without raster image variants @e2e", async ({ page }) => {
    for (const viewport of Object.values(VIEWPORTS)) {
      await loadHome(page, viewport);

      await expect(page.locator("img, picture, source[srcset], img[srcset], img[sizes]")).toHaveCount(0);

      const imageRequests = await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .filter(
            (entry) =>
              (entry as PerformanceResourceTiming).initiatorType === "img" ||
              /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(entry.name)
          ).length
      );

      expect(imageRequests).toBe(0);
      await expectNoHorizontalOverflow(page);
    }
  });
});
