# Package Killer: `otplib` / `speakeasy`

## 1. Package Normally Used
`otplib` or `speakeasy`

## 2. What functionality it provides
These packages provide Time-Based One-Time Password (TOTP) and HMAC-Based One-Time Password (HOTP) generation and validation. They implement RFC 6238 and RFC 4226, handling Base32 secret decoding, time-step calculations, drift window verification, and OTP URI generation.

## 3. What ZeroVault needs
ZeroVault needs the ability to generate and verify 6-digit TOTP codes using a user-provided Base32 secret to act as an Authenticator app (like Google Authenticator or Authy) without relying on any external packages.

## 4. Standard-library primitives used
- `node:crypto.createHmac` (for HMAC-SHA1, HMAC-SHA256, HMAC-SHA512)
- Custom minimal Base32 decoder (RFC 4648 compliant)

## 5. Our implementation architecture
ZeroVault implements TOTP natively in `src/security/totp.js`.
1. **Time Calculation:** Divides the current UNIX epoch time (or provided time) by the period (default 30s) to yield the time-step counter.
2. **Buffer Allocation:** The counter is written as an 8-byte big-endian buffer (uint64).
3. **HMAC:** Uses `node:crypto.createHmac` with the specified algorithm (default `sha1`), signing the 8-byte counter buffer using the decoded Base32 secret as the key.
4. **Dynamic Truncation:** Implements the RFC 4226 dynamic truncation algorithm: extracts a 4-byte dynamic value from the HMAC digest based on the last nibble, masks the MSB to avoid signed integer issues, and computes the modulus `10^digits` (default 6).
5. **Drift Window:** The `verifyTOTP` function generates tokens for `current - window` to `current + window` and uses `crypto.timingSafeEqual` to securely compare tokens, mitigating timing side-channels.

## 6. Feature comparison

| Feature | `otplib` | ZeroVault |
|---|---|---|
| RFC 6238 (TOTP) | Yes | Yes |
| RFC 4226 (HOTP) | Yes | Yes (Underlying impl) |
| Base32 Decode | Yes | Yes |
| Custom Time Steps | Yes | Yes |
| SHA-1, SHA-256, SHA-512 | Yes | Yes |
| Drift Window / Tolerance | Yes | Yes (±1 default) |
| Dependencies | ~4 (base32 encode/decode, etc) | **0** |

## 7. Supported functionality
- Full RFC 6238 and RFC 4226 compliance.
- Support for 6, 7, and 8 digit tokens.
- Support for SHA-1, SHA-256, and SHA-512 hashes.
- `otpauth://` URI parsing and generation.
- Exact match on all official RFC test vectors.

## 8. Limitations
- We only implemented Base32 decoding, not encoding, as Authenticator apps only ever receive Base32 strings to decode.
- We do not support Google Authenticator's non-standard edge cases, sticking strictly to the RFC.

## 9. Test evidence
ZeroVault's implementation is verified against the official RFC 6238 test vectors in `tests/security-features.test.js` and `tests/security_hardening.test.js`. It passes 100% of the SHA-1, SHA-256, and SHA-512 test vectors provided in the RFC appendices, along with tests for malformed inputs, out-of-bounds digits, and empty strings.

## 10. Why no third-party dependency is required
TOTP is simply an HMAC over a timestamp counter. Node.js provides a robust, heavily audited HMAC implementation via OpenSSL (`node:crypto.createHmac`). The only missing piece is a Base32 decoder, which requires only ~20 lines of standard JavaScript. By writing this small decoding shim, we eliminate the need for `otplib` or `speakeasy`, dropping the dependency footprint and reducing supply chain risk entirely for this critical security component.
