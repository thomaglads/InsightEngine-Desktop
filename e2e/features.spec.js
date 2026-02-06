import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should allow CSV file selection', async ({ page }) => {
    // Find file input
    const fileInput = page.locator('input[type="file"]').first();
    
    // Create a test CSV file
    const testFilePath = path.join(__dirname, 'fixtures', 'test-data.csv');
    
    // Upload file
    await fileInput.setInputFiles(testFilePath);
    
    // Wait for processing indicator or success message
    await expect(page.locator('text=/processing|uploading|loading/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should reject invalid file types', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    
    // Try to upload a text file
    const invalidFile = {
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This is not a CSV file')
    };
    
    await fileInput.setInputFiles([invalidFile]);
    
    // Should show error or validation message
    await expect(page.locator('text=/invalid|error|csv required/i').first()).toBeVisible({ timeout: 3000 });
  });

  test('should show file size validation', async ({ page }) => {
    // Create a mock large file
    const largeFile = {
      name: 'large.csv',
      mimeType: 'text/csv',
      buffer: Buffer.alloc(200 * 1024 * 1024) // 200MB
    };
    
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles([largeFile]);
    
    // Should show size error
    await expect(page.locator('text=/too large|size limit|exceeds/i').first()).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should send a message', async ({ page }) => {
    // Find chat input
    const chatInput = page.locator('input[placeholder*="chat" i], input[placeholder*="ask" i], textarea').first();
    
    // Type a message
    await chatInput.fill('Show me total sales');
    await chatInput.press('Enter');
    
    // Message should appear in chat
    await expect(page.locator('text=/Show me total sales/i').first()).toBeVisible();
  });

  test('should display SQL generation loading state', async ({ page }) => {
    const chatInput = page.locator('input[placeholder*="chat" i], input[placeholder*="ask" i], textarea').first();
    
    await chatInput.fill('What is the average?');
    await chatInput.press('Enter');
    
    // Should show loading or processing indicator
    await expect(page.locator('text=/generating|processing|thinking/i, [data-testid="loading"]').first())
      .toBeVisible({ timeout: 5000 });
  });

  test('should show SQL results', async ({ page }) => {
    const chatInput = page.locator('input[placeholder*="chat" i], input[placeholder*="ask" i], textarea').first();
    
    await chatInput.fill('Count all records');
    await chatInput.press('Enter');
    
    // Wait for results
    await page.waitForTimeout(3000);
    
    // Should display results or SQL code
    const results = page.locator('pre, code, [data-testid="result"], table, .result').first();
    await expect(results).toBeVisible({ timeout: 10000 });
  });
});