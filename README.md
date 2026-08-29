# ZeroVault

> A locally-hosted, zero-dependency encrypted secret vault — AES-256-GCM + Argon2id + TOTP + secret scanning. Zero npm packages.

---

## The Problem

Developers scatter secrets across `.env` files, Slack messages, git history, and sticky notes. Cloud password managers require trusting a third party with your most sensitive data and introduce supply-chain risk through transitive npm dependencies.

## The Solution

ZeroVault is a self-hosted, offline-capable encrypted secret vault built **entirely on the Node.js standard library** — no Express, no crypto-js, no uuid, no Jest, no otplib. Every capability is powered by `node:crypto`, `node:http`, `node:fs`, `node:test`, and `node:util`.

---

## Features

| Feature | Implementation |
|---|---|
| 🔐 Encrypted Vault | AES-256-GCM + Argon2id + HMAC-SHA256 |
| 🔑 TOTP Authenticator | RFC 6238 (SHA-1/256/512), replaces `otplib` |
| 🔍 Secret Scanner | 10+ pattern rules + Shannon entropy detection |
| 🎲 CSPRNG Generator | Password, passphrase, Hex/Base64 key |
| 🛡️ Security Audit | Deterministic password scoring |
| 📁 File Protection | Inspect, secure (0o600), hash, shred |
| 🏗️ Reproducible Build | Deterministic SHA-256 verified |
| ✅ Zero Dependencies | 0 runtime npm packages |

---

## Architecture

```
zerovault/
├── bin/              # CLI entry point
├── src/
│   ├── vault/        # Core vault: format, crypto, manager, persistence
│   ├── crypto/       # AES-GCM, KDF (Argon2id + HKDF), CSPRNG
│   ├── security/     # TOTP, scanner, generator, audit, file protection
│   ├── server/       # node:http server, router, static serving, routes
│   └── cli/          # CLI commands
├── public/           # Vanilla HTML/CSS/JS frontend (no framework)
├── tests/            # 164 tests (node:test + node:assert)
├── tools/            # dependency-check.js, reproducible-build.js
└── docs/             # PACKAGE-KILLER.md, REPRODUCIBLE-BUILD.md, DEMO.md
```

---

## Zero Dependency Philosophy

ZeroVault proves that a security-grade application needs **zero npm packages**. The complete runtime dependency list:

- `node:crypto` — AES-256-GCM, Argon2id, HKDF, HMAC, CSPRNG, UUID
- `node:http` — HTTP server and router
- `node:fs` — vault file I/O, atomic writes, file shredding
- `node:path` — file path utilities
- `node:util` — CLI argument parsing

See [STDLIB.md](STDLIB.md) for the full list of 12 package substitutions.

---

## Prerequisites

- Node.js >= 25.0.0

---

## Installation

```bash
git clone https://github.com/nikhiltelkar2005-glitch/zero-vault.git
cd zero-vault
npm install   # Installs nothing. dependencies: {} devDependencies: {}
```

---

## Running

```bash
# Start the web server (default port 3000)
npm start

# Or specify a port
node bin/zerovault.js serve --port 8080
```

Open `http://localhost:3000` in your browser.

---

## One-Command Build

```bash
npm run build
```

**Output:** `zerovault-release.tar` at the repository root.

**How to run the artifact:**

```bash
tar -xf zerovault-release.tar
node bin/zerovault.js serve
```

No compilation step. Node.js executes source files directly.

---

## Testing

```bash
npm test
```

**Result:** 164 tests, 0 failures.

Coverage: vault security, authentication, authorization, crypto primitives, TOTP RFC vectors, scanner adversarial cases, generator CSPRNG, audit determinism, persistence fault tolerance.

---

## Dependency Proof

```bash
npm run verify
```

**Expected output:**
```
ZERO VAULT DEPENDENCY CHECK

Runtime dependencies: 0
Third-party runtime imports: 0

PASS — ZERO THIRD-PARTY RUNTIME DEPENDENCIES
```

---

## Reproducible Build

```bash
npm run build   # Run #1 — note SHA-256
npm run build   # Run #2 — hashes must match
```

Both runs produce identical SHA-256 hashes. See [docs/REPRODUCIBLE-BUILD.md](docs/REPRODUCIBLE-BUILD.md) for the verified hashes and full explanation.

---

## Vault Security

### Cryptographic Architecture

| Operation | Algorithm | Node.js API |
|---|---|---|
| Key Derivation | Argon2id | `crypto.argon2Sync` |
| Key Expansion | HKDF-SHA256 | `crypto.hkdfSync` |
| Encryption | AES-256-GCM | `crypto.createCipheriv` |
| Outer Signature | HMAC-SHA256 | `crypto.createHmac` |
| CSPRNG | OS TRNG | `crypto.randomBytes` |

### Vault File Format

```
MAGIC     (4  bytes) ZVLT
VERSION   (1  byte)  0x01
KDF_ID    (1  byte)  0x01 (Argon2id)
KDF_PARAMS(12 bytes) time, memory, parallelism
SALT      (32 bytes) random
IV        (12 bytes) random (96-bit GCM nonce)
HMAC      (32 bytes) outer HMAC-SHA256 (header + tag + ciphertext)
TAG       (16 bytes) AES-GCM authentication tag
CIPHERTEXT(variable) encrypted JSON payload
```

### Key Derivation

The master password is **never stored**. On every unlock:
1. Argon2id derives a 64-byte raw key from password + salt
2. HKDF-SHA256 expands that into two 256-bit keys: `encKey` (AES-GCM) and `macKey` (HMAC)
3. Both keys are zero-filled immediately after use (`Buffer.fill(0)`)

### Persistence Safety

Vault writes are **atomic**: data is written to a `.tmp` file first, then `fs.renameSync` replaces the target. A crash or power loss cannot corrupt an existing vault.

---

## TOTP

ZeroVault replaces `otplib` with a native RFC 6238 implementation:
- SHA-1, SHA-256, SHA-512 support
- 6, 7, and 8 digit tokens
- Configurable drift window
- `otpauth://` URI parsing and generation
- All official RFC 6238 test vectors pass

---

## Secret Scanner

Detects 10+ secret types including:
- AWS Access Keys (AKIA prefix, exactly 20 chars)
- GitHub PATs (`ghp_`, `gho_`, `github_pat_`)
- Stripe live/test keys (`sk_live_`, `sk_test_`)
- JWT tokens (3-part base64url)
- Slack tokens (`xoxb-`, `xoxp-`)
- Private key blocks (RSA, EC, OpenSSH, PGP)
- Database connection strings with embedded credentials
- High-entropy strings (Shannon entropy >= 4.5 bits/char)

**Security guarantee:** Raw secret values are **never** returned in findings or API responses. Only redacted forms (`AKIA****************`) are exposed.

---

## Generator

Cryptographically secure password generator:
- Passwords: configurable length, uppercase, lowercase, digits, symbols
- Passphrases: Diceware-style with entropy calculation
- Hex keys: arbitrary-length hex strings
- Base64 keys: URL-safe base64

All randomness from `crypto.randomBytes` — `Math.random()` is never used.

---

## Security Audit

Deterministic password strength scoring:
- Length analysis
- Character set diversity
- Common pattern detection (keyboard walks, dictionary words, dates)
- Entropy estimation
- Vault-wide duplicate detection

---

## Threat Model

### Protected Against
- ✅ Accidental plaintext storage of secrets on disk
- ✅ Unauthorized vault access attempts (wrong password fails HMAC verification)
- ✅ Vault file tampering (outer HMAC-SHA256 detects any modification)
- ✅ Ciphertext tampering (AES-GCM auth tag rejects modified ciphertext)
- ✅ Header tampering (AAD binding means header changes invalidate the tag)
- ✅ Timing attacks on password comparison (`timingSafeEqual` for HMAC check)
- ✅ Accidental secret exposure through scanner output (redaction enforced)
- ✅ Supply-chain attacks via npm (zero runtime dependencies)
- ✅ Atomic write failures (`.tmp` + `renameSync` prevents vault corruption)

### Not Protected Against
- ❌ Malware with access to the running process
- ❌ A compromised operating system (root/kernel access)
- ❌ Hardware keyloggers capturing the master password
- ❌ Memory forensics — V8 strings from `JSON.parse` cannot be zero-filled
- ❌ OS memory paging — `node:crypto` Buffers may be paged to disk under memory pressure (no `mlock()`)
- ❌ Malicious browser extensions with access to the page
- ❌ A fully compromised host machine

> **Honest note:** ZeroVault assumes the host machine is reasonably secure. If the host is compromised, no password manager that decrypts secrets in memory is safe.

---

## Security Assumptions & Limitations

1. **Memory pinning:** Node.js lacks `mlock()`. Sensitive `Buffer` objects are explicitly zero-filled (`buf.fill(0)`) after cryptographic use. V8 immutable strings cannot be proactively zeroed — they remain in memory until GC.

2. **Single-user, local-only:** ZeroVault runs on `localhost`. No TLS, no auth tokens, no multi-user access control. Do not expose the port to a network.

3. **Synchronous KDF:** `argon2Sync` blocks the event loop. This is intentional (KDF must be slow), but the server cannot handle concurrent requests during a KDF operation.

4. **No key rotation:** In-place master password rotation is not implemented in Phase 1–5.

---

## Package Killer

ZeroVault demonstrates that `otplib` (and its transitive dependencies) is unnecessary. Our implementation uses only `node:crypto.createHmac` and a 30-line Base32 decoder to achieve full RFC 6238 compliance.

See [docs/PACKAGE-KILLER.md](docs/PACKAGE-KILLER.md) for the full analysis.

---

## Standard Library Substitutions

ZeroVault makes 12 genuine standard-library substitutions:

| Replaced | With |
|---|---|
| `express` | `node:http` |
| `axios` | Browser `fetch` |
| `jest` | `node:test` |
| `otplib` | `node:crypto.createHmac` |
| `argon2` npm | `node:crypto.argon2Sync` |
| `hkdf` | `node:crypto.hkdfSync` |
| `commander` | `node:util.parseArgs` |
| `uuid` | `node:crypto.randomUUID` |
| `crypto-js` | `node:crypto` |
| `glob` | `node:fs.readdirSync` |
| `dotenv` | `process.env` |
| `write-file-atomic` | `fs.renameSync` |

See [STDLIB.md](STDLIB.md) for details and trade-off analysis.

---

## Demo

See [docs/DEMO.md](docs/DEMO.md) for a scripted 5-minute demo walkthrough.
