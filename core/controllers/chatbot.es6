import config from 'config';
import createGeoCoder from 'node-geocoder';
import Bus, {Events} from '../dispatchers/main-bus.es6';
import {Bot, Elements, Buttons} from 'facebook-messenger-bot';
import {ChatBotDispatcher, ContextStore} from '../../libs/chatbot.es6';
import {Freedaa} from '../../libs/chat-bot/index.es6';
import * as Post from './post.es6';
import imgur from 'imgur';
import * as User from './user.es6';
import CleverBot from 'cleverbot.io';
import fetch from '../../libs/fetch.es6';

export default class MongoContextStore extends ContextStore {
  async read(uid) {
    const user = await User.getUserById(uid);

    console.log(user);

    if (user) {
      return user.context;
    }

    return null;
  }

  async write(uid, context) {
    console.log(uid, context);

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

const cleverbot = new CleverBot('jSNrlROQLe2mO64c', 'vhxWWCBZxfjSxW4zvZoVmqmFLWl3qJxh');

imgur.setCredentials(config.get('Imgur.email'), config.get('Imgur.password'), config.get('Imgur.clientId'));

async function send(id, {elements = [], options = []}) {
  for (const element of elements) {
    const out = new Elements();
    out.add(element);
    out.setQuickReplies(options);

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

dispatcher.registerBot(Freedaa, {
  async onPostView(id, uid) {
    try {
      const {uid: to} = await Post.getPost(id);
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
  },
  async onUserLocationChange(uid, {long, lat}) {
    console.log('onUserLocationChange', uid, {long, lat});
    await User.updateUser(uid, {coordinates: [long, lat]});
  },
  async onUserOnboard(uid) {
    console.log('User onboard', uid);
    const {first_name: first, last_name: last} = await bot.fetchUser(uid, 'first_name,last_name');

    try {
      await User.createUser(uid, {first, last});
    } catch (e) {
      console.error(new TraceError('User already exists', e));
    }
  }
}, {
  async getAddressFromCoordinates([lat, long]) {
    return new Promise((resolve, reject) => {
      geocoder.reverse({lat, lon: long}, (err, address) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(address[0].replace(/(undefined)/g, ''));
      });
    });
  },
  async parseTime(input) {
    const {body: {dates, error}} = await fetch('http://natty.joestelmach.com/parse', {
      json: true,
      method: 'post',
      headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'},
      body: `value=${encodeURIComponent(input)}`
    });

    if (error) {
      throw error;
    }

    return dates.map(d => new Date(new Date(d).getTime()));
  },
  async getCurrentTime({lat, long}){
    const {body: {rawOffset, dstOffset, status}, body} = await fetch('https://maps.googleapis.com/maps/api/timezone/json', {
      json: true,
      query: {location: `${lat},${long}`, key: config.get('Google.key'), timestamp: 1458000000}
    });

    if (status === 'OK') {
      return new Date(Date.now() + rawOffset * 1000 + dstOffset * 1000);
    } else {
      console.error(body);
      throw new TraceError('Could not get time');
    }
  },
  async getSass(input, tag = null) {
    cleverbot.setNick(tag);

    return new Promise((resolve, reject) => {
      cleverbot.create(function (err) {
        if (err) {
          console.error(err);
          return reject(err);
        }

        cleverbot.ask(input, function (err, text) {
          if (err) {
            console.error(err);
            return reject(err);
          }

          resolve(text);
        });
      });
    });
  },
  async addPost(uid, {location, start, end, description, image}) {
    console.log(image);

    try {
      const {data: {link}} = await imgur.uploadUrl(image);

      image = link;
    } catch (e) {
      console.error(e);
    }

    return await Post.createPost(uid, {description, start, end, location, image});
  },
  async setUserNotificationOption(uid, value) {
    await User.updateUser(uid, {notifications: value});
  },
  async getUserNotificationOption(uid) {
    return await User.getUserById(uid);
  },
  async getPosts(coordinates, date) {
    return await Post.findActivePosts(coordinates, date);
  },
  async getPost(id) {
    return await Post.getPost(id);
  },
  async removePost(id) {
    return await Post.removePost(id, 'User deleted the post');
  }
});


Bus.on(Events.FACEBOOK_MESSAGE_RECEIVED, body => bot.handleMessage(body));

bot.on('message', message => respond(message));
bot.on('optin', (message, param) => respond(message));
bot.on('postback', (event, message) => respond(message));
bot.on('invalid-postback', (message, data) => console.log(data, message));

Bus.on(Events.CORE_POST_VERIFIED, async({_id, uid}) => {
  const {first_name: first} = await bot.fetchUser(uid, 'first_name');
  const res = await dispatcher.dispatch(Freedaa.Actions.NOTIFY_USER_POST_VERIFIED, uid, _id, {first});

  await send(uid, res);
});
