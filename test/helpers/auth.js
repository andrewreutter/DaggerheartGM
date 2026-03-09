/**
 * Playwright helper: mock Firebase client-side auth so tests can exercise
 * the authenticated app without a real Firebase project.
 *
 * Usage in a Playwright test:
 *
 *   import { authenticate } from '../helpers/auth.js';
 *
 *   test('my test', async ({ page }) => {
 *     await authenticate(page);       // must be called before page.goto()
 *     await page.goto('/');
 *     // app now renders as a signed-in user
 *   });
 */

export const TEST_USER = {
  uid: 'test-user-uid',
  email: 'test@example.com',
  displayName: 'Test User',
};

export const TEST_TOKEN = 'test-token';

// Minimal ESM mock for https://www.gstatic.com/firebasejs/.../firebase-app.js
const MOCK_FIREBASE_APP_JS = `
export function initializeApp() { return {}; }
export function getApp() { return {}; }
export function getApps() { return [{}]; }
`;

// Minimal ESM mock for https://www.gstatic.com/firebasejs/.../firebase-auth.js
// onAuthStateChanged immediately calls the callback with the test user so
// that the React app renders its authenticated shell.
const MOCK_FIREBASE_AUTH_JS = `
const mockUser = {
  uid: 'test-user-uid',
  email: 'test@example.com',
  displayName: 'Test User',
  getIdToken: async () => 'test-token',
};

const mockAuth = { currentUser: mockUser };

export function getAuth() { return mockAuth; }

export function onAuthStateChanged(_auth, callback) {
  // Defer slightly so the React render cycle has started before auth resolves.
  setTimeout(() => callback(mockUser), 0);
  return () => {};
}

export class GoogleAuthProvider {}
export async function signInWithPopup() { return { user: mockUser }; }
export async function signOut() {}
`;

/**
 * Set up all route mocks required for an authenticated session.
 * MUST be called before page.goto().
 *
 * Mocks:
 *   - Firebase CDN JS (app + auth) with in-memory stubs
 *   - /api/config  → minimal config, no image gen
 *   - /api/me      → { isAdmin: false }
 *   - /api/my-rooms → { rooms: [] }
 *   - /api/data/table_state → empty table state
 */
export async function authenticate(page) {
  // Intercept Firebase CDN modules
  await page.route('https://www.gstatic.com/firebasejs/**firebase-app.js', (route) => {
    route.fulfill({ contentType: 'application/javascript', body: MOCK_FIREBASE_APP_JS });
  });
  await page.route('https://www.gstatic.com/firebasejs/**firebase-auth.js', (route) => {
    route.fulfill({ contentType: 'application/javascript', body: MOCK_FIREBASE_AUTH_JS });
  });

  // /api/config — return empty firebaseConfig (Firebase is fully mocked on client)
  await page.route('/api/config', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ firebaseConfig: {}, imageGenEnabled: false }),
    });
  });

  // /api/me — not an admin test user
  await page.route('/api/me', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ isAdmin: false }),
    });
  });

  // /api/my-rooms — no rooms
  await page.route('/api/my-rooms', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ rooms: [] }),
    });
  });

  // /api/data/table_state — empty, so the GM table starts clean
  await page.route('/api/data/table_state*', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [], totalCount: 0 }),
    });
  });
}
