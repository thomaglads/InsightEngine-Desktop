import { test, expect } from '@playwright/test';

test.describe('InsightEngine Desktop - Application Load', () => {
  test('should display the main application', async ({ page }) => {
    await page.goto('/');
    
    // Check if main app container is visible
    await expect(page.locator('#root')).toBeVisible();
    
    // Check if header is present
    await expect(page.locator('header, [role="banner"]').first()).toBeVisible();
  });

  test('should have correct page title', async ({ page }) => {
    await page.goto('/');
    
    await expect(page).toHaveTitle(/InsightEngine|Insight Engine/i);
  });

  test('should load without console errors', async ({ page }) => {
    const consoleErrors = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    
    // Wait for app to fully load
    await page.waitForLoadState('networkidle');
    
    // Check no critical errors (exclude non-critical warnings)
    const criticalErrors = consoleErrors.filter(
      error => !error.includes('Source map') && 
               !error.includes('hot-update') &&
               !error.includes('WebSocket')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Navigation & UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display file upload area', async ({ page }) => {
    // Look for file upload component
    const uploadArea = page.locator('[data-testid="file-upload"], input[type="file"]').first();
    await expect(uploadArea).toBeVisible();
  });

  test('should display chat interface', async ({ page }) => {
    // Look for chat input or chat container
    const chatInput = page.locator('input[placeholder*="chat"], input[placeholder*="ask"], textarea').first();
    await expect(chatInput).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // App should still be visible and functional
    await expect(page.locator('#root')).toBeVisible();
  });
});