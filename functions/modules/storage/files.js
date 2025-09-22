/* storage/files.js
   Media delete validation (uploads happen client-side via rules)
*/
const { makeRouter, asyncHandler } = require('../utils/helpers');

const router = makeRouter();

router.post('/delete', asyncHandler(async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath required' });
  const allowed = filePath.startsWith(`uploads/${req.user.uid}/`) || filePath.includes(`/${req.user.uid}/`);
  if (!allowed && !(req.user.role === 'admin' || req.user.admin === true)) return res.status(403).json({ error: 'Forbidden' });
  // Client should call Storage SDK to actually delete. This endpoint is for auditing/approval hooks.
  return res.json({ ok: true });
}));

module.exports = router;
