import config from 'config';
import createGeoCoder from 'node-geocoder';
import Bus, {Events} from '../dispatchers/main-bus.es6';
import {Bot, Elements, Buttons} from 'facebook-messenger-bot';
import {ChatBotDispatcher, ContextStore} from '../../libs/chatbot.es6';
import {Freedaa} from '../../libs/chat-bot/index.es6';
import * as Post from './post.es6';
import imgur from 'imgur';
import * as User from './user.es6';

export default class MongoContextStore extends ContextStore {
  async read(uid) {
    const user = await User.getUserById(uid);

    if (user) {
      return user.context;
    }

    return null;
  }

  async write(uid, context) {
    return await User.updateUser(uid, {context});
  }
}

const dispatcher = new ChatBotDispatcher(new MongoContextStore());
const bot = new Bot(config.get('Facebook.accessToken'));
const geocoder = createGeoCoder('google', 'https', {
  apiKey: config.get('Google.key'),
  formatter: 'string',
  formatterPattern: '%n %S in %c'
});

imgur.setCredentials(config.get('Imgur.email'), config.get('Imgur.password'), config.get('Imgur.clientId'));

function transform(post) {
  if (!post) {
    return null;
  }

  post.id = post._id;
  post.uid = post.userId;
  post.start = new Date(post.start);
  post.end = new Date(post.end);
  post.location = post.coordinates;

  return post;
}

async function setUserNotificationOption(uid, value) {
  await User.updateUser(uid, {notifications: value});
}

async function getUserNotificationOption(uid) {
  return await User.getUserById(uid);
}

async function onUserLocationChange(uid, {long, lat}) {
  await User.updateUser(uid, {coordinates: [long, lat]});
}

async function removePost(id) {
  return await Post.removePost(id, 'User deleted the post');
}

async function getAddressFromCoordinates([lat, long]) {
  return new Promise((resolve, reject) => {
    geocoder.reverse({lat, lon: long}, (err, address) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({address});
    });
  });
}

async function onPostView(id, uid) {
  try {
    const {userId: to} = await Post.getPost(id);
    if (to === uid) {
      return;
    }

    const {first_name: first} = await bot.fetchUser(uid, 'first_name'); // TODO store into db
    const {text} = await dispatcher.dispatch(Freedaa.Actions.NOTIFY_USER_ON_POST_VIEW, to, {first});
    const out = new Elements().add({text});
    await bot.send(to, out);
  } catch (e) {
    console.error(e);
  }
}

async function addPost(uid, {location, start, end, description, image}) {
  try {
    const {data: {link}} = await imgur.uploadUrl(image);

    image = link;
  } catch (e) {
    console.error(e);
  }

  return transform(await Post.createPost(uid, {description, start, end, coordinates: location, image}));
}

async function onUserOnboard(uid) {
  console.log('User onboard', uid);
  const {first_name: first, last_name: last} = await bot.fetchUser(uid, 'first_name,last_name');

  try {
    await User.createUser(uid, {first, last});
  } catch (e) {
    console.error(new TraceError('User already exists', e));
  }
}

async function getPosts(coordinates) {
  return (await Post.findActivePosts(coordinates)).map(post => transform(post));
}

async function getPost(id) {
  return transform(await Post.getPost(id));
}

async function send(id, {texts = [], text, cards}) {
  if (text) {
    texts = texts.concat(text);
  }

  if (cards) {
    const out = new Elements();

    for (const {text: t, image, options, subtext} of cards) {
      const buttons = new Buttons();

      if (options) {
        options.forEach(({data, text: _text}) => buttons.add({data, text: _text}));
      }

      out.add({text: t, subtext, image, buttons});
    }

    try {
      await bot.send(id, out); // eslint-disable-line babel/no-await-in-loop
    } catch (e) {
      console.error(e);
    }
  }

  for (const t of texts) {
    const out = new Elements();
    out.add({text: t});

    try {
      await bot.send(id, out); // eslint-disable-line babel/no-await-in-loop
    } catch (e) {
      console.error(e);
    }

    await Bot.wait(1400); // eslint-disable-line babel/no-await-in-loop
  }
}

async function respond(message) {
  const {sender} = message;

  sender.id = String(sender.id); // cast to String in order to ensure MongoDB doesn't convert int => double

  const {first_name: first, last_name: last} = await sender.fetch('first_name,last_name', true);
  const res = await dispatcher.dispatch(Freedaa.Actions.INPUT, sender.id, message, {first, last});

  await send(sender.id, res);
}

Bus.on(Events.FACEBOOK_MESSAGE_RECEIVED, body => bot.handleMessage(body));

bot.on('message', message => Bus.emit(Events.CORE_MESSAGE_RECEIVED, message));
bot.on('optin', (message, param) => Bus.emit(Events.CORE_MESSAGE_RECEIVED, message, param));
bot.on('postback', (event, message, data) => Bus.emit(Events.CORE_MESSAGE_POSTBACK, event, message, data));
bot.on('invalid-postback', (message, data) => console.log(data, message));

const onMessagePostBack = (event, message) => respond(message);
const onMessageReceived = message => respond(message);
const onPostVerified = async ({_id, userId}) => {
  const {first_name: first} = await bot.fetchUser(userId, 'first_name');
  const res = await dispatcher.dispatch(Freedaa.Actions.NOTIFY_USER_POST_VERIFIED, userId, _id, {first});

  await send(userId, res);
};

export function setChatbotEnabled(e) {
  Bus.removeListener(Events.CORE_POST_VERIFIED, onPostVerified);
  Bus.removeListener(Events.CORE_MESSAGE_POSTBACK, onMessagePostBack);
  Bus.removeListener(Events.CORE_MESSAGE_RECEIVED, onMessageReceived);
  if (e) {
    Bus.on(Events.CORE_POST_VERIFIED, onPostVerified);
    Bus.on(Events.CORE_MESSAGE_POSTBACK, onMessagePostBack);
    Bus.on(Events.CORE_MESSAGE_RECEIVED, onMessageReceived);
  }
}

dispatcher.registerBot(Freedaa, {
  onPostView,
  onUserLocationChange,
  onUserOnboard
}, {
  getAddressFromCoordinates,
  addPost,
  setUserNotificationOption,
  getUserNotificationOption,
  getPosts,
  getPost,
  removePost
});

setChatbotEnabled(config.get('Chatbot.enabled'));
