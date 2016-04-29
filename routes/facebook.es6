import {Router} from 'express';
import Bus, {Events} from '../core/dispatchers/main-bus.es6'

const router = new Router();

router.get('/messenger/webhook', (req, res) => {
    if (req.query['hub.verify_token'].indexOf('entree_123') === 0) {
        res.send(req.query['hub.challenge']);
    } else {
        res.send('Error, wrong validation token');
    }
});

router.post('/messenger/webhook', (req, res) => {
    Bus.emit(Events.FACEBOOK_MESSAGE_RECEIVED, req.body);
    res.send().status(200);
});

export default router;