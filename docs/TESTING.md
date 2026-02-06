# Testing Guide

## Overview
InsightEngine Desktop uses a comprehensive testing strategy with unit tests (Jest) and E2E tests (Playwright).

## Test Structure

```
├── src/
│   ├── services/__tests__/     # Service unit tests
│   └── utils/__tests__/        # Utility unit tests
├── e2e/
│   ├── app.spec.js            # Application load tests
│   ├── features.spec.js       # Feature E2E tests
│   └── fixtures/              # Test data files
├── playwright.config.js        # Playwright configuration
└── jest.config.json           # Jest configuration
```

## Unit Tests (Jest)

### Running Unit Tests

```bash
# Run all unit tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode (development)
npm run test:watch

# Run specific test file
npm test -- aiService.test.js

# Run with verbose output
npm test -- --verbose
```

### Test Coverage

Current coverage thresholds (Phase 1):
- Statements: 35%
- Branches: 25%
- Functions: 30%
- Lines: 35%

Target for Phase 3:
- All metrics: 70%

### Writing Unit Tests

Example test structure:
```javascript
import { myFunction } from '../myModule.js';

describe('MyModule', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something', () => {
    const result = myFunction();
    expect(result).toBe(expectedValue);
  });
});
```

### Best Practices

1. **Mock external dependencies**
   ```javascript
   jest.mock('../api', () => ({
     fetchData: jest.fn()
   }));
   ```

2. **Test edge cases**
   - Empty inputs
   - Invalid inputs
   - Boundary conditions
   - Error scenarios

3. **Use descriptive test names**
   - Good: `should return empty array when no data exists`
   - Bad: `test case 1`

## E2E Tests (Playwright)

### Running E2E Tests

```bash
# Install browsers (first time only)
npx playwright install

# Run all E2E tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Run specific test file
npx playwright test e2e/app.spec.js

# Run in debug mode
npm run test:e2e:debug

# Run with specific browser
npx playwright test --project=chromium

# Run headed (visible browser)
npx playwright test --headed
```

### Test Configuration

Playwright configuration in `playwright.config.js`:

```javascript
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 2 : 0,
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

### Writing E2E Tests

Example test:
```javascript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should perform action', async ({ page }) => {
    // Arrange
    const button = page.locator('[data-testid="submit"]');
    
    // Act
    await button.click();
    
    // Assert
    await expect(page.locator('.success')).toBeVisible();
  });
});
```

### Best Practices

1. **Use semantic selectors**
   - Good: `page.locator('button:has-text("Submit")')`
   - Better: `page.locator('[data-testid="submit-button"]')`

2. **Wait for network idle**
   ```javascript
   await page.waitForLoadState('networkidle');
   ```

3. **Handle dynamic content**
   ```javascript
   await expect(locator).toBeVisible({ timeout: 10000 });
   ```

4. **Use fixtures for test data**
   ```javascript
   const fileInput = page.locator('input[type="file"]');
   await fileInput.setInputFiles('e2e/fixtures/test-data.csv');
   ```

## CI/CD Testing

### GitHub Actions

Tests run automatically on:
- Pull requests to `main`, `lemon`, `develop`
- Pushes to these branches
- Release creation

### Test Reports

- Jest coverage: `coverage/` directory
- Playwright reports: `playwright-report/` directory
- Codecov integration for coverage tracking

## Debugging Tests

### Unit Test Debugging

```bash
# Add debugger statement in test
npm test -- --inspect-brk

# Use Chrome DevTools
chrome://inspect
```

### E2E Test Debugging

```bash
# Run in debug mode
npx playwright test --debug

# Run with UI
npx playwright test --ui

# Slow motion (see each action)
npx playwright test --headed --slow-mo 1000
```

## Common Issues

### Unit Tests

1. **Module not found**
   - Check jest.config.js moduleNameMapper
   - Verify file path in import

2. **Async test timeout**
   - Increase timeout: `jest.setTimeout(10000)`
   - Check for missing await

3. **Snapshot failures**
   - Update snapshots: `npm test -- -u`
   - Review changes before committing

### E2E Tests

1. **Element not found**
   - Increase timeout
   - Check if element is in viewport
   - Wait for dynamic content

2. **Test flakiness**
   - Add retries in config
   - Use explicit waits
   - Check for race conditions

3. **Browser installation**
   ```bash
   npx playwright install
   ```

## Test Data

### Fixtures

Store test files in `e2e/fixtures/`:
- `test-data.csv` - Sample CSV for upload tests
- Add more as needed

### Mock Data

For unit tests, create mocks in `__mocks__/` directory or inline:
```javascript
const mockData = {
  columns: ['name', 'age'],
  rows: [
    { name: 'John', age: 30 },
    { name: 'Jane', age: 25 }
  ]
};
```

## Performance Testing

### Load Testing

```bash
# Run E2E tests with multiple workers
npx playwright test --workers=4
```

### Memory Testing

Monitor memory usage in E2E tests:
```javascript
test('memory test', async ({ page }) => {
  const client = await page.context().newCDPSession(page);
  const metrics = await client.send('Performance.getMetrics');
  console.log(metrics);
});
```

## Security Testing

### Automated Security Checks

- npm audit runs in CI
- CodeQL analysis on all PRs
- No secrets in test files

### Manual Security Tests

1. **XSS Prevention**
   - Try injecting scripts in inputs
   - Verify output is sanitized

2. **File Upload Security**
   - Test file type validation
   - Test file size limits
   - Test path traversal attempts

## Maintenance

### Updating Tests

1. When adding features, add tests first (TDD)
2. Update tests when changing functionality
3. Remove tests for deprecated features

### Test Reviews

Include in code review:
- [ ] Tests cover new functionality
- [ ] Tests pass locally
- [ ] No sensitive data in tests
- [ ] Tests are readable and maintainable

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)