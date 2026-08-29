# ZeroVault Standard Library Substitution Log

This document records every third-party npm package that ZeroVault replaces with
Node.js built-in standard library functionality. Each substitution is genuine and
verifiable in the repository source code.

---

## 1. Express → `node:http`

**Normally:** `express`

**Instead:** `node:http` (`createServer`, `IncomingMessage`, `ServerResponse`)

**Why:** ZeroVault needs an HTTP server to serve the API and static frontend files.

**How:** We implement a lightweight custom `Router` class in `src/server/router.js` that parses the URL, dispatches to registered route handlers, reads the request body with `req.on('data')`, and sends JSON or binary responses via `res.end()`. Static files are served via `src/server/static.js` which reads files with `fs.readFileSync`.

**Trade-off:** We do not have middleware chains, CORS helpers, or production-grade features like streaming body parsers or compression. These are acceptable given ZeroVault's local-only threat model.

---

## 2. Axios / node-fetch → `node:http`

**Normally:** `axios` or `node-fetch`

**Instead:** Native `fetch` in the browser (`window.fetch`) and `node:http` on the server.

**Why:** The frontend needs to call ZeroVault's REST API endpoints.

**How:** The browser-side `public/js/app.js` uses the globally available browser `fetch()` API with `JSON.stringify` / `JSON.parse` for request and response serialization. There is no server-side outbound HTTP, so no Node fetch library is needed.

**Trade-off:** No automatic retries, interceptors, or typed response handling. Pure fetch is sufficient for a local-host API.

---

## 3. Jest / Mocha → `node:test` + `node:assert`

**Normally:** `jest`, `mocha`, or `vitest`

**Instead:** `node:test` (built-in test runner since Node.js 18) and `node:assert`.

**Why:** Running 160+ tests covering vault security, crypto, TOTP, scanner, generator, and audit modules.

**How:** Test files import `test` from `node:test` and `assert` from `node:assert`. Tests are run via `node --test tests/*.test.js`. All assertions use `assert.strictEqual`, `assert.ok`, `assert.throws`, `assert.rejects`, etc.

**Trade-off:** No snapshot testing, no built-in coverage reports, no watch mode. Node's test runner is leaner but sufficient for our use case.

---

## 4. `otplib` / `speakeasy` → `node:crypto` + Custom TOTP

**Normally:** `otplib` or `speakeasy`

**Instead:** `node:crypto.createHmac` with a custom RFC 4648 Base32 decoder (~30 lines) and RFC 4226 dynamic truncation.

**Why:** ZeroVault acts as a TOTP authenticator app, needing to generate and verify 6-digit time-based tokens from a user's Base32 secret.

**How:** `src/security/totp.js` implements the full TOTP/HOTP stack: Base32 decode → 8-byte big-endian counter buffer → HMAC (SHA-1/256/512) → dynamic truncation → modulo 10^digits. Verification uses `crypto.timingSafeEqual` for constant-time comparison. All official RFC 6238 test vectors pass.

**Trade-off:** No QR code generation. We implement only what's needed.

---

## 5. `argon2` npm package → `node:crypto.argon2Sync`

**Normally:** `argon2` npm package (native C bindings)

**Instead:** `node:crypto.argon2Sync` (built into Node.js >= 21.7)

**Why:** Password-based key derivation for the vault master password using memory-hard Argon2id.

**How:** `src/crypto/kdf.js` calls `crypto.argon2Sync(password, salt, { type: 'argon2id', ... })` and then expands the output with `crypto.hkdfSync` into two domain-separated keys (encKey, macKey). Zero compiled C extensions needed.

**Trade-off:** Requires Node.js >= 21.7. The synchronous variant blocks the event loop during KDF (acceptable since KDF is intentionally slow and the server is single-user).

---

## 6. `hkdf` / `@noble/hashes` → `node:crypto.hkdfSync`

**Normally:** `hkdf` npm package or `@noble/hashes`

**Instead:** `node:crypto.hkdfSync`

**Why:** Key expansion and domain separation — the raw Argon2id output is expanded into two independent 256-bit keys for AES-256-GCM encryption and HMAC-SHA256 outer signature.

**How:** `src/crypto/kdf.js` calls `crypto.hkdfSync('sha256', rawKey, salt, info, keyLength)` twice with different `info` labels (`'enc'` and `'mac'`) to produce fully independent keys.

**Trade-off:** None. `hkdfSync` is a clean, well-audited standard implementation.

---

## 7. `commander` / `yargs` → `node:util.parseArgs`

**Normally:** `commander`, `yargs`, or `minimist`

**Instead:** `node:util.parseArgs` (available since Node.js 18.3)

**Why:** The `zerovault` CLI needs to parse flags like `--port 3000` for the `serve` command.

**How:** `src/cli/index.js` uses `parseArgs({ args, options: { port: { type: 'string' } }, allowPositionals: true })` from `node:util` to cleanly parse CLI arguments without external packages.

**Trade-off:** No automatic `--help` generation, no sub-command routing library. Usage strings are manual. Sufficient for our small CLI surface.

---

## 8. `uuid` → `node:crypto.randomUUID`

**Normally:** `uuid` npm package

**Instead:** `node:crypto.randomUUID()`

**Why:** VaultManager assigns a unique ID to each credential entry when it is created.

**How:** `src/vault/manager.js` calls `import { randomUUID } from 'node:crypto'` and uses `randomUUID()` to generate RFC-compliant UUIDs from the OS CSPRNG. No npm package required.

**Trade-off:** None. `randomUUID()` is a drop-in replacement for `uuid.v4()`.

---

## 9. `crypto-js` / `aes-js` → `node:crypto` AES-256-GCM + HMAC-SHA256

**Normally:** `crypto-js` or `aes-js` (pure-JS crypto implementations)

**Instead:** `node:crypto.createCipheriv` / `createDecipheriv` / `createHmac`

**Why:** All vault cryptographic operations — AES-256-GCM authenticated encryption/decryption and HMAC-SHA256 outer signature.

**How:** `src/crypto/aead.js` wraps `createCipheriv('aes-256-gcm', ...)` with full input validation, AAD binding, and auth-tag enforcement. `src/vault/vault.js` uses `createHmac('sha256', macKey)` for the outer signature with `timingSafeEqual` for constant-time comparison.

**Trade-off:** We get hardware-accelerated AES-NI (via OpenSSL) which pure-JS libraries cannot match. This is strictly better.

---

## 10. `glob` / `fast-glob` → `node:fs.readdirSync` (recursive)

**Normally:** `glob` or `fast-glob` for recursive file traversal

**Instead:** `node:fs.readdirSync` with a manual recursive `scanDir` function

**Why:** The dependency checker (`tools/dependency-check.js`) and the reproducible build tool (`tools/reproducible-build.js`) need to recursively enumerate all `.js` and source files in the project directory.

**How:** A simple `function scanDir(dir)` loops over `fs.readdirSync(dir)`, checks `fs.statSync(fullPath).isDirectory()`, and recurses. Results are accumulated in a flat array. Binary/hidden files (`.DS_Store`) are filtered manually.

**Trade-off:** No glob patterns or negation patterns. Manual filtering is sufficient for our structured project layout.

---

## 11. `dotenv` → `process.env` + `process.argv`

**Normally:** `dotenv`

**Instead:** `process.env` (Node.js built-in) and `process.argv` via `node:util.parseArgs`

**Why:** Configuration values like PORT are needed at runtime.

**How:** The `serve` CLI command reads `process.argv` for `--port`, defaulting to `3000`. No `.env` file loading is needed since ZeroVault is a local-only, single-user tool.

**Trade-off:** No `.env` file parsing. Since ZeroVault's entire premise is to BE the secret store, loading from `.env` would be circular.

---

## 12. `write-file-atomic` → `fs.writeFileSync` + `renameSync`

**Normally:** `write-file-atomic`

**Instead:** `node:fs.writeFileSync` (to a `.tmp` file) + `node:fs.renameSync`

**Why:** The vault file must be written atomically to prevent corruption if the process is interrupted mid-write.

**How:** `src/vault/persistence.js` writes to `filePath.${Date.now()}.tmp` first, then calls `fs.renameSync(tmpPath, filePath)`. If write fails, the `.tmp` file is cleaned up and the original vault is untouched. `renameSync` is atomic on POSIX systems.

**Trade-off:** `renameSync` is not strictly atomic on Windows across drives. Since ZeroVault targets Mac/Linux, this is acceptable.

---

## Summary

| Package Replaced | Node.js Built-in Used | Location |
|---|---|---|
| `express` | `node:http` | `src/server/` |
| `axios` / `node-fetch` | Browser `fetch` | `public/js/app.js` |
| `jest` / `mocha` | `node:test`, `node:assert` | `tests/` |
| `otplib` / `speakeasy` | `node:crypto.createHmac` | `src/security/totp.js` |
| `argon2` npm | `node:crypto.argon2Sync` | `src/crypto/kdf.js` |
| `hkdf` / `@noble/hashes` | `node:crypto.hkdfSync` | `src/crypto/kdf.js` |
| `commander` / `yargs` | `node:util.parseArgs` | `src/cli/index.js` |
| `uuid` | `node:crypto.randomUUID` | `src/vault/manager.js` |
| `crypto-js` | `node:crypto` AES-GCM/HMAC | `src/crypto/aead.js` |
| `glob` / `fast-glob` | `node:fs.readdirSync` recursive | `tools/` |
| `dotenv` | `process.env` + `process.argv` | `src/cli/index.js` |
| `write-file-atomic` | `fs.writeFileSync` + `renameSync` | `src/vault/persistence.js` |
