/* admin/roles.js
   Admin endpoints to assign roles, suspend/reactivate users
*/
const admin = require('firebase-admin');
const { makeRouter, asyncHandler } = require('../utils/helpers');

const router = makeRouter();

function ensureAdmin(req, res) {
  if (!(req.user && (req.user.role === 'admin' || req.user.admin === true))) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

router.post('/setRole', asyncHandler(async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  const { uid, claims } = req.body;
  await admin.auth().setCustomUserClaims(uid, claims || {});
  res.json({ ok: true });
}));

router.post('/suspend', asyncHandler(async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  const { uid } = req.body;
  await admin.auth().updateUser(uid, { disabled: true });
  res.json({ ok: true });
}));

router.post('/reactivate', asyncHandler(async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  const { uid } = req.body;
  await admin.auth().updateUser(uid, { disabled: false });
  res.json({ ok: true });
}));

module.exports = router;
