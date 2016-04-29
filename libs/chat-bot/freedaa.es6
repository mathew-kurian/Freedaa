import keyMirror from 'keymirror';
import {Bot, Context, Types} from '../chatbot.es6';
import {step, CATCH, FALLBACK, PROXY} from './fsm.es6';
import CleverBot from 'cleverbot.io';
import fetch from '../fetch.es6';
import moment from 'moment';
import tdiff from '../tdiff.es6';

const UTC_OFFSET = new Date().getTimezoneOffset() * 60000;
const HOUR = 60 * 60 * 1000;
const TAG = 'freedaa';

function wrap(a) {
  return {output: a};
}

const cleverbot = new CleverBot('jSNrlROQLe2mO64c', 'vhxWWCBZxfjSxW4zvZoVmqmFLWl3qJxh');

async function getSass(input, tag = null) {
  cleverbot.setNick(tag);

  return new Promise((resolve, reject) => {
    cleverbot.create(function (err) {
      if (err) {
        console.error(err);
        return reject(err);
      }

      cleverbot.ask(input, function (err, res) {
        if (err) {
          console.error(err);
          return reject(err);
        }

        resolve(res);
      });
    });
  });
}

export default class Freedaa extends Bot {
  static Context = class extends Context {
    state = Freedaa.State.START;
    started = undefined;
    location = undefined;
    time = undefined;
    postLocation = undefined;
    postDescription = undefined;
    postImage = undefined;
    postState = undefined;
  };

  static botname = 'Freedaa';
  static version = 1;

  static Actions = keyMirror({INPUT: null, NOTIFY_USER_ON_POST_VIEW: null, NOTIFY_USER_POST_VERIFIED: null});
  static State = keyMirror({START: null, SEARCH: null, SUBMIT: null, SASSY: null, NOTIFICATIONS: null});

  static actionTypes = {
    onUserOnboard: Types.Async.any(),
    onPostView: Types.Async.any(),
    onUserLocationChange: Types.Async.any()
  };

  static adapterTypes = {
    setUserNotificationOption: Types.Async.any(),
    getUserNotificationOption: Types.Async.any({notifications: Boolean}),
    getAddressFromCoordinates: Types.Async.parse({address: String}),
    addPost: Types.Async.any({
      id: String,
      description: String,
      start: Date,
      end: Date,
      image: String
    }),
    getPost: Types.Async.parse({
      id: String,
      location: Object,
      views: Number
    }),
    removePost: Types.Async.any(),
    getPosts: Types.Async.parseArray({
      id: String,
      description: String,
      start: Date,
      end: Date,
      image: String
    })
  };

  static createContext = uid => new Freedaa.Context(uid);

  constructor(...args) {
    super(...args);

    this.registerAction(Freedaa.Actions.INPUT, this.onInput);
    this.registerAction(Freedaa.Actions.NOTIFY_USER_ON_POST_VIEW, this.onNotifyUserOnPostView);
    this.registerAction(Freedaa.Actions.NOTIFY_USER_POST_VERIFIED, this.onPostVerified);
  }

  async onPostVerified(id) {
    const {adapters} = this;
    const post = await adapters.getPost(id);

    return {
      text: 'Your post has been verified!',
      cards: [this._formatPostToCard(post, [{
        text: 'Delete',
        data: {action: 'delete', post: post.id}
      }])]
    };
  }

  async onNotifyUserOnPostView({first}) {
    return {text: `${first} just viewed your post`};
  }

  _formatPostToCard(post, options = [
    {text: 'Location', data: {action: 'location', post: post.id}},
    {text: 'Report', data: {action: 'report', post: post.id}}
  ]) {
    return {
      text: post.description,
      subtext: `${moment(post.start).format('LT')} - ${moment(post.end).format('LT')} · ${post.views} views`,
      image: post.image,
      options
    };
  }

  async onInput({text = '', optin = false, images, location, data = {}}, {first}) {
    const {context, actions, adapters} = this;

    const result = await step({
      [PROXY]: {
        transitions: {
          deletePost: {
            test: [data.action === 'delete', !!data.post],
            process: async() => {
              try {
                await adapters.removePost(data.post);
                return wrap({text: 'Your post has been deleted'});
              } catch (e) {
                return wrap({text: 'Your post has already been deleted'});
              }
            }
          },
          notifications: {
            test: [context.started, /^notify/ig],
            transitionTo: Freedaa.State.NOTIFICATIONS
          },
          notificationsEnable: {
            test: [data.action === 'notifications'],
            process: async() => {
              adapters.setUserNotificationOption(context.uid, data.value);
              return wrap({text: 'I will hit you up then. Just type "notify" if you change your mind'});
            }
          },
          notificationsDisable: {
            test: [data.action === 'notifications'],
            process: async() => {
              adapters.setUserNotificationOption(context.uid, data.value);
              return wrap({text: 'I will hit you up then. Just type "notify" if you change your mind'});
            }
          },
          tooHungry: {
            test: [context.started,
              async() => (await tdiff('i want free food, i\'m hungry', text.toLowerCase())) > 0.6],
            process: async() => wrap({text: 'Yappers. Send me your location.'})
          },
          location: {
            test: [!!location, context.started],
            process: async() => {
              context.time = Date.now();
              context.location = location;
              actions.onUserLocationChange(context.uid, location);
              const {address} = await adapters.getAddressFromCoordinates([location.lat, location.long]);
              return wrap({
                card: {
                  text: `${first}, looks like you are located on ${address}.`,
                  options: [
                    {data: {ns: Freedaa.State.SEARCH}, text: 'Find food around me'},
                    {data: {ns: Freedaa.State.SUBMIT}, text: 'I spotted free food'}
                  ]
                }
              });
            }
          },
          getPostLocation: {
            test: [data.action === 'location', !!data.post],
            process: async() => {
              try {
                const {location: _location} = await adapters.getPost(data.post);
                const {address} = await adapters.getAddressFromCoordinates(_location);

                actions.onPostView(data.post, context.uid);

                return wrap({text: `Located at ${address}`});
              } catch (e) {
                console.error(e);
                return wrap({text: 'Post has been deleted :('});
              }
            }
          },
          goToSearch: {
            test: [data.ns === Freedaa.State.SEARCH, !!context.location],
            transitionTo: data.ns
          },
          goToSubmit: {
            test: [data.ns === Freedaa.State.SUBMIT, !!context.location],
            transitionTo: data.ns
          },
          quit: {
            test: /^(quit|clear|reset)/ig,
            process: async() => wrap({text: 'Ok'}),
            transitionTo: Freedaa.State.SASSY
          },
          help: {
            test: /^help$/ig,
            process: async() => wrap({text: 'Just send me your location to begin.'})
          },
          checkOptin: {
            test: [context.started, !!optin],
            process: async() => wrap({text: 'You are already signed up! Just send me your location to begin.'})
          }
        }
      },
      [Freedaa.State.SEARCH]: {
        process: async() => {
          const posts = await adapters.getPosts(context.location);
          const {address} = await adapters.getAddressFromCoordinates([context.location.lat, context.location.long]);

          if (!posts.length) {
            const {notifications} = await adapters.getUserNotificationOption(context.uid);

            if (!notifications) {
              return {
                ...wrap({
                  cards: [{
                    text: `Sorry, I can't seem to find any food around you :( Do you want me to let you know when
                    someone finds free found?`,
                    options: [{text: 'Yeah! Notify me', data: {action: 'notifications', value: true}}]
                  }]
                })
              };
            }

            return {
              ...wrap({
                text: `Sorry, I can't seem to find any food around you - ${address} :(`
              })
            };
          }

          const cards = posts.map(post => this._formatPostToCard(post));

          return wrap({cards});
        },
        transitionTo: Freedaa.State.SASSY
      },
      [Freedaa.State.NOTIFICATIONS]: {
        process: async() => wrap({text: 'Do you want me to notify you if someone finds free food near you?'}),
        transitions: {
          notifyMe: {
            test: /^(yes|yeah|yah|yee*?|y|yay*?)/ig,
            process: async() => {
              adapters.setUserNotificationOption(context.uid, true);
              return wrap({text: 'I will hit you up then. Just type "notify" if you change your mind'});
            },
            transitionTo: Freedaa.State.SASSY
          },
          dontNotifyMe: {
            test: /^(no|don'?t|nah*?|nay*?|n)/ig,
            process: async() => {
              adapters.setUserNotificationOption(context.uid, false);
              return wrap({text: 'Ok. Just type "notify" if you change your mind'});
            },
            transitionTo: Freedaa.State.SASSY
          },
          [FALLBACK]: {
            process: async() => wrap({text: 'Didn\'t really get you there. Yay or nay?'})
          }
        }
      },
      [Freedaa.State.SUBMIT]: {
        process: async() => {
          const {address} = await adapters.getAddressFromCoordinates([context.location.lat, context.location.long]);

          context.postLocation = context.location;
          context.postDescription = null;
          context.postExpiration = null;
          context.postImage = null;
          context.postAddress = address;
          context.postState = 'description';

          return wrap({
            text: `✓ Location: ${context.postAddress}\\n
            ▸ Description\\n
            □ Picture\\n
            □ Time\\n\\n

            Tell me more about the food and its location`
          });
        },
        transitions: {
          addDescriptionThenRequestImage: {
            test: [!!text, !context.postDescription],
            process: async() => {
              const updated = !!context.postDescription;
              context.postDescription = text;
              context.postState = 'image';

              if (updated) {
                return wrap({text: 'Ok I updated the description. Ok now I need that picture'});
              }

              return wrap({
                text: `✓ Location: ${context.postAddress}\\n
                ✓ Description: ${context.postDescription}\\n
                ▸ Picture\\n
                □ Time\\n\\n

                Yum! Now I just need a picture.`
              });
            }
          },
          addImageThenRequestPeriod: {
            test: [!!images, !context.postImage, !!context.postDescription],
            process: async() => {
              context.postImage = images[0];
              context.postState = 'period';

              return wrap({
                text: `✓ Location: ${context.postAddress}\\n
                ✓ Description: ${context.postDescription}\\n
                ✓ Picture\\n
                ▸ Time\\n\\n

                Ok soo close. Let me know a START and END time e.g. between 10 and 11 am`
              });
            }
          },
          addPeriodAndFinalize: {
            test: [!!text, !!context.postDescription, !!context.postImage],
            process: async() => {
              let start;
              let end;

              try {
                const {body: {dates, error}} = await fetch('http://natty.joestelmach.com/parse', {
                  json: true,
                  method: 'post',
                  headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'},
                  body: `value=${encodeURIComponent(text.replace(/^today/i, ''))}`
                });

                if (error) {
                  throw error;
                } else if (dates.length === 2) {
                  start = new Date(new Date(dates[0]).getTime() + UTC_OFFSET);
                  end = new Date(new Date(dates[1]).getTime() + UTC_OFFSET);
                }
              } catch (e) {
                throw new TraceError('Could not parse date', e);
              }

              if (!end) {
                return wrap({text: 'Looks like your missing an end time. I need a START and END time'});
              } else if (end - start > HOUR * 5) {
                return wrap({text: 'This event lasts wayyy too long! Is this a real event?'});
              } else if (start > new Date(Date.now() + UTC_OFFSET + HOUR * 24)) {
                return wrap({text: 'Sucks to suck! Remind me when it gets closer.'});
              } else if (end < new Date()) {
                return wrap({text: 'Wait. This event already finished? Let\'s try again. START and END time please'});
              }

              try {
                const post = await adapters.addPost(context.uid, {
                  location: context.postLocation,
                  description: context.postDescription,
                  image: context.postImage,
                  start, end
                });

                return {
                  ...wrap({
                    text: 'You are all set! We will notify you when your post is verified.',
                    cards: [this._formatPostToCard(post, [{
                      text: 'Delete',
                      data: {action: 'delete', post: post.id}
                    }])]
                  }),
                  transitionTo: Freedaa.State.SASSY
                };
              } catch (e) {
                console.tag(TAG, 'addPeriodAndFinalize').error(e);
                return wrap({text: 'I think you broke us!'});
              }
            }
          },
          [FALLBACK]: {
            process: async() => {
              const state = context.postState;
              if (state === 'description' || state === 'period') {
                return wrap({text: 'I need a text input'});
              }

              return wrap({text: 'Send me a picture'});
            }
          }
        }
      },
      [Freedaa.State.SASSY]: {
        transitions: {
          sassy: {
            test: !!text,
            process: async() => wrap({text: await getSass(text, first)})
          },
          imageUnaccepted: {
            test: !!images,
            process: async() => wrap({text: 'Sending me photos. Por que?'})
          }
        }
      },
      [Freedaa.State.START]: {
        transitions: {
          introduction: {
            test: !context.started,
            process: async() => {
              await actions.onUserOnboard(context.uid); // FIXME user should be created on read/write context
              context.started = true;
              return wrap({
                text: [`Hey ${first}, my name is Freedaa and I can help you find free food around you.`,
                  'Send me your location to begin.']
              });
            }
          },
          tutorialLocation: {
            test: !!location,
            transitionTo: PROXY
          },
          [FALLBACK]: {
            process: async() =>
              wrap({
                text: `In the Messenger app, to send me a location - click the pin icon at the bottom.
                  Unfortunately, you cannot send a location from the website.`
              })
          }
        }
      },
      [CATCH]: {
        process: async e => {
          console.error(e);
          return wrap({text: `Ummm. I think you broke us: ${e.message.substr(0, 200)}`});
        }
      },
      [FALLBACK]: {
        transitions: {
          help: {
            test: /^\/help$/,
            process: async() => 'Help!'
          }
        }
      }
    }, this.context.state, text || '', this);

    const {output, next} = result;

    this.context.state = next;

    if (output && output.card) {
      output.cards = [output.card];
      delete output.card;
    }

    if (output.cards) {
      for (const card of output.cards) {
        if (card.text) card.text = this._flattenText(card.text);
        if (card.subtext) card.subtext = this._flattenText(card.subtext);
      }
    }

    if (output && output.text) {
      const texts = Array.isArray(output.text) ? output.text : [output.text];
      output.texts = texts.map(t => this._flattenText(t));

      delete output.text;
    }

    return output;
  }

  _flattenText(t) {
    t = t.trim();
    t = t.replace(/\n/g, ' ');
    t = t.replace(/ {2,}/g, ' ');
    t = (t.match(/[^\.!\?]+[\.!\?]*/g) || [t]).map(s => s.trim()).join(' ');
    t = t.replace(/\\n/g, '\n');
    t = t.replace(/\n +/g, '\n');

    return t;
  }
}
