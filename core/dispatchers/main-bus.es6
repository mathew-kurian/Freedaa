import EventEmitter from 'events';
import keyMirror from 'keymirror';

export const Events = keyMirror({
  CORE_MESSAGE_RECEIVED: null,
  CORE_MESSAGE_POSTBACK: null,
  CORE_POST_VERIFIED: null,
  CORE_POST_DELETED: null,
  FACEBOOK_MESSAGE_RECEIVED: null
});

const bus = new EventEmitter();

export default bus;

