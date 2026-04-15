const express = require('express');
const router = express.Router();

// POST /api/auth
// Body: { password: string }
// Returns 200 { ok: true } if correct, 401 { ok: false } if not.
// The password is set via the ADMIN_PASSWORD env var (fallback: 'admin' for local dev).
router.post('/', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

  if (password === adminPassword) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false });
  }
});

module.exports = router;
