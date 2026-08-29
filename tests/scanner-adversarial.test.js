import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSecrets, redactText, looksLikeBinary } from '../src/security/scanner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'scanner');

test('Scanner Adversarial — Fake Secrets Fixture', () => {
  const filePath = path.join(FIXTURES_DIR, 'fake_secrets.js');
  const text = fs.readFileSync(filePath, 'utf8');
  
  const findings = scanSecrets(text);
  
  assert.ok(findings.length >= 8, `Expected at least 8 findings, got ${findings.length}`);
  
  // Verify redaction on all findings
  findings.forEach(f => {
    assert.ok(f.redactedValue, 'Must have redactedValue');
    assert.ok(!f.rawValue, 'Must NEVER have rawValue');
    assert.ok(!f.secret, 'Must NEVER have secret field');
  });
  
  const awsFinding = findings.find(f => f.ruleName === 'AWS Access Key ID');
  assert.ok(awsFinding, 'Must detect AWS Access Key');
  assert.strictEqual(awsFinding.redactedValue, 'AKIA****************', 'AWS Key prefix must be kept, rest redacted');
  
  const ghFinding = findings.find(f => f.ruleName === 'GitHub Personal Access Token');
  assert.ok(ghFinding, 'Must detect GitHub PAT');
  assert.strictEqual(ghFinding.redactedValue, 'ghp_************************************', 'GitHub prefix must be kept');
  
  // Verify string redaction completely removes full secrets
  const redactedText = redactText(text);
  assert.ok(!redactedText.includes('AKIAIOSFODNN7EXAMPLE'));
  assert.ok(!redactedText.includes('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'));
  assert.ok(!redactedText.includes('sk_' + 'live_' + '1234567890abcdef1234567890abcdef'));
  assert.ok(!redactedText.includes('xox' + 'b-1234567890-123456789012-ABCDEFGHIJKLMNOPQRSTUVWX'));
  assert.ok(!redactedText.includes('SuperSecretPassword123!'));
});

test('Scanner Adversarial — False Positives Fixture', () => {
  const filePath = path.join(FIXTURES_DIR, 'false_positives.txt');
  const text = fs.readFileSync(filePath, 'utf8');
  
  const findings = scanSecrets(text);
  
  assert.strictEqual(findings.length, 0, 'False positives fixture should yield ZERO findings');
});

test('Scanner Adversarial — Binary Files', () => {
  const binaryBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0xFF, 0xFE, 0xFD]);
  assert.strictEqual(looksLikeBinary(binaryBuffer.toString('binary')), true, 'Must identify binary string');
  
  const findings = scanSecrets(binaryBuffer.toString('binary'));
  assert.strictEqual(findings.length, 0, 'Must safely skip binary content');
});

test('Scanner Adversarial — Large Files', () => {
  // Create a 6MB string, which is over the 5MB API limit but the scanner core should handle it or fail gracefully.
  // Actually, we'll test a 2MB string to ensure the scanner itself performs reasonably without catastrophic backtracking.
  const largeText = 'const a = "A";\n'.repeat(100000) + 'const awsKey = "AKIAIOSFODNN7EXAMPLE";\n' + 'const b = "B";\n'.repeat(100000);
  
  const start = performance.now();
  const findings = scanSecrets(largeText);
  const duration = performance.now() - start;
  
  assert.ok(duration < 2000, `Scanner took too long on large file: ${duration}ms`);
  assert.strictEqual(findings.length, 1, 'Should find exactly one secret in large file');
  assert.strictEqual(findings[0].ruleName, 'AWS Access Key ID');
});
