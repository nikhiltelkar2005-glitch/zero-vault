import * as security from '../../security/index.js';

export function registerTotpRoutes(router) {
  router.post('/api/totp/generate', (req, res) => {
    try {
      const { secret, options } = req.body;
      if (!secret || typeof secret !== 'string') return res.json({ error: 'Missing or invalid secret' }, 400);
      const token = security.generateTOTP(secret, options || {});
      res.json({ token });
    } catch (err) {
      res.json({ error: 'TOTP generation failed. Check the secret is a valid Base32 string.' }, 400);
    }
  });

  router.post('/api/totp/verify', (req, res) => {
    try {
      const { token, secret, options } = req.body;
      if (!token || !secret) return res.json({ error: 'Missing token or secret' }, 400);
      const result = security.verifyTOTP(token, secret, options || {});
      res.json({ valid: result.valid, delta: result.delta });
    } catch (err) {
      res.json({ error: 'TOTP verification failed. Check the secret is a valid Base32 string.' }, 400);
    }
  });

  router.post('/api/totp/parse-uri', (req, res) => {
    try {
      const { uri } = req.body;
      if (!uri) return res.json({ error: 'Missing URI' }, 400);
      const parsed = security.parseOtpauthUri(uri);
      // SECURITY: Never return the raw TOTP secret to the client
      const { secret: _secret, ...safeFields } = parsed;
      res.json({ ...safeFields, secretPresent: true });
    } catch (err) {
      res.json({ error: 'Failed to parse OTP URI. Ensure the URI is a valid otpauth:// format.' }, 400);
    }
  });

  router.post('/api/totp/generate-uri', (req, res) => {
    try {
      const options = req.body;
      const uri = security.generateOtpauthUri(options);
      res.json({ uri });
    } catch (err) {
      res.json({ error: err.message }, 400);
    }
  });
}
