/**
 * Self-check for admin auth decision.
 * Run: node routes/admin.test.mjs
 *
 * Guards the security-critical rule in isAuthorized(): access is granted only
 * when ADMIN_PASSWORD is set AND the supplied value matches — and must fail
 * closed (never grant) when the secret is unset.
 */
import assert from 'assert';

// Configured: only the exact secret is accepted.
process.env.ADMIN_PASSWORD = 'test-secret';
const { isAuthorized } = await import('./admin.js?configured');
assert.strictEqual(isAuthorized('test-secret'), true, 'correct secret must be accepted');
assert.strictEqual(isAuthorized('wrong'), false, 'wrong secret must be rejected');
assert.strictEqual(isAuthorized(''), false, 'empty key must be rejected');
assert.strictEqual(isAuthorized(undefined), false, 'missing key must be rejected');

// Unset: fail closed — nothing is accepted (fresh module load reads env again).
delete process.env.ADMIN_PASSWORD;
const unset = await import('./admin.js?unset');
assert.strictEqual(unset.isAuthorized('test-secret'), false, 'must fail closed when unset');
assert.strictEqual(unset.isAuthorized(''), false, 'must fail closed when unset');

console.log('✅ admin auth decision OK');
