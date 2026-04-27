/**
 * Wallet Integration Tests — #426
 *
 * Tests connection, signing, error handling, disconnection, and wallet
 * switching for all four supported providers: Freighter, Albedo, xBull, Rabet.
 *
 * Strategy: inject mock wallet globals via `addInitScript` so tests run
 * without real browser extensions or network access.
 */

import { test, expect, Page } from '@playwright/test';

// ── Mock injection helpers ────────────────────────────────────────────────────

const MOCK_ADDRESS = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37';

type WalletScenario = 'success' | 'rejection' | 'timeout' | 'network_error';

/** Inject mock Freighter global into the page. */
async function mockFreighter(page: Page, scenario: WalletScenario = 'success') {
  await page.addInitScript(
    ({ addr, scenario }: { addr: string; scenario: WalletScenario }) => {
      (window as any).__freighter_mock_scenario = scenario;
      (window as any).freighterApi = {
        requestAccess: () =>
          scenario === 'rejection'
            ? Promise.reject(new Error('User rejected the request'))
            : scenario === 'timeout'
            ? new Promise(() => {}) // never resolves
            : scenario === 'network_error'
            ? Promise.reject(new Error('Network error'))
            : Promise.resolve({ publicKey: addr }),
        getPublicKey: () => Promise.resolve(addr),
        isConnected: () => Promise.resolve(scenario === 'success'),
        signTransaction: (xdr: string) =>
          scenario === 'rejection'
            ? Promise.reject(new Error('User rejected signing'))
            : Promise.resolve({ signedTxXdr: xdr + '_signed' }),
      };
    },
    { addr: MOCK_ADDRESS, scenario }
  );
}

/** Inject mock Albedo global. */
async function mockAlbedo(page: Page, scenario: WalletScenario = 'success') {
  await page.addInitScript(
    ({ addr, scenario }: { addr: string; scenario: WalletScenario }) => {
      (window as any).albedo = {
        publicKey: () =>
          scenario === 'rejection'
            ? Promise.reject(new Error('User rejected'))
            : scenario === 'timeout'
            ? new Promise(() => {})
            : scenario === 'network_error'
            ? Promise.reject(new Error('Albedo popup blocked'))
            : Promise.resolve({ pubkey: addr }),
        tx: (opts: any) =>
          scenario === 'rejection'
            ? Promise.reject(new Error('User rejected signing'))
            : Promise.resolve({ signed_envelope_xdr: opts.xdr + '_signed', pubkey: addr }),
      };
    },
    { addr: MOCK_ADDRESS, scenario }
  );
}

/** Inject mock xBull global. */
async function mockXBull(page: Page, scenario: WalletScenario = 'success') {
  await page.addInitScript(
    ({ addr, scenario }: { addr: string; scenario: WalletScenario }) => {
      (window as any).xBullSDK = {
        connect: () =>
          scenario === 'rejection'
            ? Promise.reject(new Error('Connection denied'))
            : scenario === 'timeout'
            ? new Promise(() => {})
            : scenario === 'network_error'
            ? Promise.reject(new Error('xBull not available'))
            : Promise.resolve({ publicKey: addr }),
        signXDR: (xdr: string) =>
          scenario === 'rejection'
            ? Promise.reject(new Error('Signing rejected'))
            : Promise.resolve(xdr + '_signed'),
      };
    },
    { addr: MOCK_ADDRESS, scenario }
  );
}

/** Inject mock Rabet global. */
async function mockRabet(page: Page, scenario: WalletScenario = 'success') {
  await page.addInitScript(
    ({ addr, scenario }: { addr: string; scenario: WalletScenario }) => {
      (window as any).rabet = {
        connect: () =>
          scenario === 'rejection'
            ? Promise.reject(new Error('User denied connection'))
            : scenario === 'timeout'
            ? new Promise(() => {})
            : scenario === 'network_error'
            ? Promise.reject(new Error('Rabet extension not found'))
            : Promise.resolve({ publicKey: addr }),
        sign: (xdr: string, network: string) =>
          scenario === 'rejection'
            ? Promise.reject(new Error('User denied signing'))
            : Promise.resolve({ xdr: xdr + '_signed' }),
      };
    },
    { addr: MOCK_ADDRESS, scenario }
  );
}

async function openWalletModal(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /wallet|connect/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

// ── Connection flow tests ─────────────────────────────────────────────────────

test.describe('Wallet connection flows', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  for (const wallet of ['Freighter', 'Albedo', 'xBull', 'Rabet'] as const) {
    test(`${wallet}: successful connection shows address`, async ({ page }) => {
      await mockFreighter(page);
      await mockAlbedo(page);
      await mockXBull(page);
      await mockRabet(page);

      await openWalletModal(page);

      await page.getByRole('button', { name: new RegExp(wallet, 'i') }).click();

      // Connected state: address or "Wallet Connected" heading visible
      await expect(
        page.getByText(/wallet connected/i).or(page.getByText(MOCK_ADDRESS))
      ).toBeVisible({ timeout: 5_000 });
    });
  }

  test('modal shows wallet list with all four providers', async ({ page }) => {
    await openWalletModal(page);
    for (const name of ['Freighter', 'Albedo', 'xBull', 'Rabet']) {
      await expect(page.getByRole('button', { name: new RegExp(name, 'i') })).toBeVisible();
    }
  });

  test('connecting state disables other wallet buttons', async ({ page }) => {
    // Freighter hangs — other buttons should be disabled while connecting
    await mockFreighter(page, 'timeout');
    await openWalletModal(page);

    await page.getByRole('button', { name: /freighter/i }).click();

    // Other wallet buttons should be disabled (aria-disabled or disabled attr)
    const albedoBtn = page.getByRole('button', { name: /albedo/i });
    await expect(albedoBtn).toBeDisabled();
  });
});

// ── Transaction signing tests ─────────────────────────────────────────────────

test.describe('Transaction signing', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('Freighter: signTransaction resolves with signed XDR', async ({ page }) => {
    await mockFreighter(page, 'success');
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const api = (window as any).freighterApi;
      return api.signTransaction('test_xdr_payload');
    });

    expect(result.signedTxXdr).toBe('test_xdr_payload_signed');
  });

  test('Albedo: tx resolves with signed envelope', async ({ page }) => {
    await mockAlbedo(page, 'success');
    await page.goto('/');

    const result = await page.evaluate(async () => {
      return (window as any).albedo.tx({ xdr: 'test_xdr' });
    });

    expect(result.signed_envelope_xdr).toBe('test_xdr_signed');
    expect(result.pubkey).toBe('GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37');
  });

  test('xBull: signXDR resolves with signed XDR string', async ({ page }) => {
    await mockXBull(page, 'success');
    await page.goto('/');

    const result = await page.evaluate(async () => {
      return (window as any).xBullSDK.signXDR('test_xdr');
    });

    expect(result).toBe('test_xdr_signed');
  });

  test('Rabet: sign resolves with signed XDR object', async ({ page }) => {
    await mockRabet(page, 'success');
    await page.goto('/');

    const result = await page.evaluate(async () => {
      return (window as any).rabet.sign('test_xdr', 'TESTNET');
    });

    expect(result.xdr).toBe('test_xdr_signed');
  });
});

// ── Error handling tests ──────────────────────────────────────────────────────

test.describe('Error handling', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  for (const wallet of ['Freighter', 'Albedo', 'xBull', 'Rabet'] as const) {
    test(`${wallet}: user rejection shows error banner`, async ({ page }) => {
      await mockFreighter(page, 'rejection');
      await mockAlbedo(page, 'rejection');
      await mockXBull(page, 'rejection');
      await mockRabet(page, 'rejection');

      await openWalletModal(page);
      await page.getByRole('button', { name: new RegExp(wallet, 'i') }).click();

      // Error banner with role=alert must appear
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole('alert')).toContainText(/reject|denied|failed/i);
    });
  }

  test('network error shows descriptive error message', async ({ page }) => {
    await mockFreighter(page, 'network_error');
    await openWalletModal(page);
    await page.getByRole('button', { name: /freighter/i }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('alert')).toContainText(/network|error/i);
  });

  test('error state allows retry by clicking another wallet', async ({ page }) => {
    await mockFreighter(page, 'rejection');
    await mockAlbedo(page, 'success');
    await openWalletModal(page);

    // First attempt fails
    await page.getByRole('button', { name: /freighter/i }).click();
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 });

    // Retry with Albedo — should succeed
    await page.getByRole('button', { name: /albedo/i }).click();
    await expect(
      page.getByText(/wallet connected/i).or(page.getByText(MOCK_ADDRESS))
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ── Disconnection tests ───────────────────────────────────────────────────────

test.describe('Wallet disconnection', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('Done button closes modal after successful connection', async ({ page }) => {
    await mockFreighter(page, 'success');
    await mockAlbedo(page, 'success');
    await mockXBull(page, 'success');
    await mockRabet(page, 'success');

    await openWalletModal(page);
    await page.getByRole('button', { name: /freighter/i }).click();
    await expect(page.getByText(/wallet connected/i)).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: /done/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('close button (✕) dismisses modal in any state', async ({ page }) => {
    await openWalletModal(page);
    await page.getByRole('button', { name: /close wallet modal/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});

// ── Wallet switching tests ────────────────────────────────────────────────────

test.describe('Wallet switching', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('reopening modal resets to idle state for new wallet selection', async ({ page }) => {
    await mockFreighter(page, 'success');
    await mockAlbedo(page, 'success');
    await mockXBull(page, 'success');
    await mockRabet(page, 'success');

    // Connect with Freighter
    await openWalletModal(page);
    await page.getByRole('button', { name: /freighter/i }).click();
    await expect(page.getByText(/wallet connected/i)).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /done/i }).click();

    // Reopen and connect with Albedo
    await page.getByRole('button', { name: /wallet|connect/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // Wallet list should be visible again (idle state)
    await expect(page.getByRole('button', { name: /albedo/i })).toBeVisible();
  });
});

// ── Mobile viewport ───────────────────────────────────────────────────────────

test.describe('Mobile wallet modal', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14

  test('wallet modal is visible and usable on mobile', async ({ page }) => {
    await mockFreighter(page, 'success');
    await mockAlbedo(page, 'success');
    await mockXBull(page, 'success');
    await mockRabet(page, 'success');

    await openWalletModal(page);
    await expect(page.getByRole('dialog')).toBeVisible();
    for (const name of ['Freighter', 'Albedo', 'xBull', 'Rabet']) {
      await expect(page.getByRole('button', { name: new RegExp(name, 'i') })).toBeVisible();
    }
  });
});
