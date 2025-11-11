# E2E Tests

End-to-end tests for Guess The Song using Playwright.

## Setup

1. Install dependencies (including Playwright):
   ```bash
   npm install
   ```

2. Install Playwright browsers (required for first-time setup):
   ```bash
   npx playwright install
   ```

   Or install only Chromium (faster, smaller download):
   ```bash
   npx playwright install chromium
   ```

## Running Tests Locally

### Basic Test Run (Headless)
Run all E2E tests in headless mode:
```bash
npm run test:e2e
```

### Watch Mode (Interactive UI)
Run tests with interactive UI to see test execution in real-time:
```bash
npm run test:e2e:ui
```

### Headed Mode (See Browser)
Run tests with visible browser windows to watch the test execution:
```bash
npx playwright test --headed
```

### Run Specific Test
Run a specific test file:
```bash
npx playwright test e2e/tests/game-flow.spec.ts
```

### Debug Mode
Run tests in debug mode (step through tests):
```bash
npx playwright test --debug
```

### View Test Report
After running tests, view the HTML report:
```bash
npx playwright show-report
```

## Local Development Tips

- **Headless mode (default)**: Faster, runs in background
- **Headed mode (`--headed`)**: See browser windows, useful for debugging
- **UI mode (`--ui`)**: Interactive interface, great for development
- **Debug mode (`--debug`)**: Step through tests, set breakpoints

## Troubleshooting

If tests fail locally:

1. **Port conflicts**: Make sure ports 8081 (backend) and 5174 (frontend) are available
2. **Browser installation**: Run `npx playwright install` if browsers aren't installed
3. **Dependencies**: Run `npm install` in root, `backend/`, and `frontend/` directories
4. **Check server logs**: Tests will show server startup logs in the console

## Test Structure

- `e2e/tests/` - Test files
- `e2e/helpers/` - Helper functions for server management, browser operations, and Spotify mocking
- `e2e/playwright.config.ts` - Playwright configuration

## Test Flow

The main test (`game-flow.spec.ts`) verifies the complete game flow:

1. Host creates a game
2. Player1 joins the game
3. Player2 joins the game
4. Host starts the game
5. Verify song is playing
6. Player2 buzzes
7. Verify song stopped

## Server Management

Tests automatically start and stop:
- Backend server on port 8081
- Frontend server on port 5174

## Spotify Mocking

All Spotify API calls and the Spotify Web Playback SDK are mocked in tests. No real Spotify credentials are required.

## CI/CD

E2E tests are designed to run in CI/CD pipelines. They use headless browsers and automatically install dependencies.

