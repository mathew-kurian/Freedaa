import EventEmitter from 'events';
import keyMirror from 'keymirror';

export const Events = keyMirror({
  CORE_POST_VERIFIED: null,
  FACEBOOK_MESSAGE_RECEIVED: null,
  CORE_POST_DELETED: null
});

const bus = new EventEmitter();

export default bus;

