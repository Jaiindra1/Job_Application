const router = require('express').Router();
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/autoApplyController');
const { requireAuth } = require('../middleware/auth');
const { aiRateLimit } = require('../middleware/aiRateLimit');

router.use(requireAuth);
router.get('/settings', asyncHandler(controller.getSettings));
router.put('/settings', asyncHandler(controller.saveSettings));
router.get('/status', asyncHandler(controller.status));
router.get('/queue', asyncHandler(controller.queue));
router.get('/jobs', asyncHandler(controller.jobs));
router.get('/history', asyncHandler(controller.history));
router.post('/run', asyncHandler(controller.run));
router.post('/prepare', aiRateLimit, asyncHandler(controller.prepare));
router.patch('/drafts/:id', asyncHandler(controller.updateDraft));
router.post('/drafts/:id/save-cover-letter', asyncHandler(controller.saveCoverLetter));
router.post('/drafts/:id/mark-applied', asyncHandler(controller.markApplied));
router.get('/:id', asyncHandler(controller.detail));
router.post('/:id/retry', asyncHandler(controller.retry));
router.post('/:id/cancel', asyncHandler(controller.cancel));
router.post('/:id/approve', asyncHandler(controller.approve));
router.post('/:id/mark-applied', asyncHandler(controller.markApplied));

module.exports = router;
