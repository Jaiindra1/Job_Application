const router=require('express').Router(),asyncHandler=require('../middleware/asyncHandler'),controller=require('../controllers/gmailController'),{requireAuth}=require('../middleware/auth');
router.get('/auth',requireAuth,asyncHandler(controller.auth));
router.get('/callback',asyncHandler(controller.callback));
router.get('/status',requireAuth,asyncHandler(controller.status));
router.post('/sync',requireAuth,asyncHandler(controller.sync));
router.delete('/disconnect',requireAuth,asyncHandler(controller.disconnect));
module.exports=router;
