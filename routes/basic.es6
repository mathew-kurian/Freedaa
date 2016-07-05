import {Router} from 'express';

const router = new Router();

router.get('/', (req, res) => res.render('index'));
router.get('/privacy', (req, res) => res.render('privacy', {title: 'Privacy'}));
router.get('/verify', (req, res) => res.render('verify', {title: 'Verify'}));

export default router;
