import {Router} from 'express';
import {setChatbotEnabled} from '../core/controllers/chatbot.es6';

const router = new Router();

router.get('/', (req, res) => res.render('index'));
router.get('/privacy', (req, res) => res.render('privacy', {title: 'Privacy'}));
router.get('/verify', (req, res) => res.render('verify', {title: 'Verify'}));
router.get('/chatbot', (req, res) => {
  const enabled = req.query.enabled === 'true';
  setChatbotEnabled(enabled);
  res.send(`${enabled}. Ok`);
});

export default router;
