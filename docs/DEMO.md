# ZeroVault — 5-Minute Demo Script

A structured walkthrough for judges and reviewers. Aim for 5 minutes total.

---

## 0:00 — The Problem (30 seconds)

> "Every developer ends up with secrets scattered across .env files, Slack messages,
> and sticky notes. The common solution is a cloud password manager — but that means
> trusting a third party with your most sensitive data. ZeroVault is a locally-hosted,
> zero-dependency encrypted vault that never sends your secrets anywhere."

**Show:** Nothing yet — just talk.

---

## 0:30 — Zero Dependency Proof (30 seconds)

```bash
cat package.json   # Show dependencies: {} and devDependencies: {}
npm run verify     # Run the dependency checker
```

**Expected output:**
```
ZERO VAULT DEPENDENCY CHECK

Runtime dependencies: 0
Third-party runtime imports: 0

PASS — ZERO THIRD-PARTY RUNTIME DEPENDENCIES
```

> "The entire application — HTTP server, AES-256-GCM crypto, Argon2id key derivation,
> TOTP authenticator, secret scanner — runs on zero npm packages."

---

## 1:00 — Create and Unlock Vault (30 seconds)

```bash
npm start    # Server starts on http://localhost:3000
```

**In the browser:**
1. Open `http://localhost:3000`
2. Click **Create New Vault**
3. Enter master password, choose a vault file path
4. Click **Create** — vault is created and unlocked

> "The vault is an AES-256-GCM encrypted binary file. The master password is never
> stored anywhere — not in memory after lock, not on disk, not in the database."

---

## 1:30 — Add a Credential (30 seconds)

1. Navigate to **Vault** tab
2. Click **Add Credential**
3. Enter: Service = `GitHub`, Username = `demo@example.com`, Password = `(use the generator)`
4. Click **Save**
5. Show the credential in the list — password is masked

> "Credentials are stored encrypted. Click the eye icon to reveal, but the plaintext
> is never written to disk or logged."

---

## 2:00 — TOTP Authenticator (30 seconds)

1. Navigate to **Authenticator** tab
2. Enter a Base32 TOTP secret (e.g. `JBSWY3DPEHPK3PXP`)
3. Click **Generate Token**
4. Show the 6-digit token and countdown timer

> "Our TOTP implementation passes all RFC 6238 official test vectors. It replaces
> the `otplib` npm package entirely using `node:crypto.createHmac`."

---

## 2:30 — Secret Scanner (45 seconds)

1. Navigate to **Scanner** tab
2. Paste the following into the text box:
```
const AWS_KEY = 'AKIAIOSFODNN7EXAMPLE';
const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.abc123';
const normal = 'hello world this is fine';
```
3. Click **Scan**
4. Show the findings — severity badges, redacted values

> "The scanner detects 10+ secret patterns. The critical security guarantee: raw
> secrets never appear in findings or API responses — only redacted forms."

---

## 3:15 — Security Audit (30 seconds)

1. Navigate to **Audit** tab
2. Enter a weak password: `password123`
3. Click **Audit**
4. Show the score breakdown — entropy, length, patterns, score

> "The audit is deterministic — the same password always gives the same score.
> The audit output never exposes the raw password."

---

## 3:45 — Lock / Restart / Unlock (30 seconds)

1. Click **Lock Vault** in the header
2. Show that credential access is now blocked (401 from API)
3. Stop the server (`Ctrl+C`) and restart: `npm start`
4. Unlock the vault with the master password
5. Confirm all credentials are still there

> "The master password is never persisted. Every restart requires re-entry.
> The encrypted vault file is the only thing that survives a restart."

---

## 4:15 — Dependency Proof + Build (30 seconds)

```bash
npm run verify     # Zero dependency check
npm run build      # Reproducible build
npm run build      # Run again — hashes must match
```

> "Both builds produce the same SHA-256. Our POSIX tar builder is written in pure
> Node.js buffers with fixed timestamps and alphabetically sorted files — completely
> deterministic, no OS tools required."

---

## 4:45 — Package Killer + STDLIB (15 seconds)

> "We documented 12 genuine standard-library substitutions in `STDLIB.md`. The
> Package Killer is our TOTP implementation, which replaces `otplib` — 4 transitive
> dependencies — with `node:crypto.createHmac` and 30 lines of Base32 decoding.
> See `docs/PACKAGE-KILLER.md` for the full comparison."

---

## 5:00 — Final Pitch (close)

> "ZeroVault is a production-quality, locally-hosted secrets manager with:
>
> - AES-256-GCM + Argon2id + HMAC-SHA256 cryptography
> - Atomic vault writes for crash-safety
> - TOTP 2FA, secret scanning, password auditing, CSPRNG generation
> - 164 tests, 0 failures
> - Zero runtime npm dependencies
> - Reproducible builds with matching SHA-256 hashes
>
> All of this. Zero packages."
