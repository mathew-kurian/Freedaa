import keyMirror from 'keymirror';
import {Bot, Context, Types} from '../chatbot.es6';
import {step, CATCH, FALLBACK, PROXY} from './fsm.es6';
import moment from 'moment';
import tdiff from '../tdiff.es6';

export default class Freedaa extends Bot {
  static Context = class extends Context {
    state = Freedaa.State.START;
    started = false;
    location = undefined;
    time = undefined;
    postLocation = undefined;
    postDescription = undefined;
    postImage = undefined;
    postState = undefined;
    postStart = undefined;
  };

  static botname = 'Freedaa';
  static version = 1;

  static Actions = keyMirror({INPUT: null, NOTIFY_USER_ON_POST_VIEW: null, NOTIFY_USER_POST_VERIFIED: null});
  static State = keyMirror({START: null, SEARCH: null, SUBMIT: null, SASSY: null, NOTIFICATIONS: null, POST: null});

  static actionTypes = {
    onUserOnboard: Types.Async.any(),
    onPostView: Types.Async.any(),
    onUserLocationChange: Types.Async.any()
  };

  static adapterTypes = {
    setUserNotificationOption: Types.Async.any(),
    getUserNotificationOption: Types.Async.any({notifications: Boolean}),
    getCoordinatesFromAddress: Types.Async.parse({lat: Number, long: Number}),
    getAddressFromCoordinates: Types.Async.any(),
    getSass: Types.Async.any(),
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
    parseTime: Types.Async.any(),
    getCurrentTime: Types.Async.any(),
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
      elements: [
        {text: 'Your post has been verified!'},
        null,
        this._formatPostToCard(post, [{text: 'Delete', data: {action: 'delete', post: post._id}}])
      ]
    };
  }

  async onNotifyUserOnPostView({first}) {
    return {elements: [{text: `${first} just viewed your post`}]};
  }

  async onInput({text = '', optin = false, images, location, data = {}}, {first}) {
    const {context, actions, adapters} = this;

    if (/(^\d{5}$)|(^\d{5}-\d{4}$)/.test(text)) {
      try {
        location = await adapters.getCoordinatesFromAddress(text);
        text = '';
      } catch (e) {
        // ignore
      }
    }

    const result = await step({
      [PROXY]: {
        transitions: {
          deletePost: {
            test: [data.action === 'delete', !!data.post],
            process: async() => {
              try {
                await adapters.removePost(data.post);
                return {output: {elements: [{text: 'Your post has been deleted'}]}};
              } catch (e) {
                return {output: {elements: [{text: 'Your post has already been deleted'}]}};
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
              return {output: {elements: [{text: 'I will hit you up then. Just type "notify" if you change your mind'}]}};
            }
          },
          notificationsDisable: {
            test: [data.action === 'notifications'],
            process: async() => {
              adapters.setUserNotificationOption(context.uid, data.value);
              return {output: {elements: [{text: 'I will hit you up then. Just type "notify" if you change your mind'}]}};
            }
          },
          tooHungry: {
            test: [context.started,
              async() => (await tdiff('i want free food, i\'m hungry', text.toLowerCase())) > 0.6],
            process: async() => ({output: {elements: [{text: 'Yappers. Send me your location or enter your zip code.'}]}})
          },
          location: {
            test: [!!location, context.started],
            process: async() => {
              context.time = Date.now();
              context.location = location;
              actions.onUserLocationChange(context.uid, location);

              return {
                output: {
                  elements: [{
                    text: `${first}, what would you like to do?`,
                    buttons: [
                      {data: {ns: Freedaa.State.SEARCH}, text: 'Find food around me'},
                      {data: {ns: Freedaa.State.SUBMIT}, text: 'I spotted free food'}
                    ]
                  }]
                },
                transitionTo: Freedaa.State.SASSY
              };
            }
          },
          getPostLocation: {
            test: [data.action === 'lead', !!data.post],
            process: async() => {
              try {
                const post = await adapters.getPost(data.post);

                actions.onPostView(data.post, context.uid);

                if (post.national) {
                  return {output: {elements: [{text: `${post.description} - ${moment(post.start).format('MMM D LT')} to ${moment(post.end).format('MMM D LT')}`}]}};
                } else {
                  const address = await adapters.getAddressFromCoordinates(post.location);
                  return {output: {elements: [{text: `${post.description} - go get it at ${address} between ${moment(post.start).format('MMM D LT')} and ${moment(post.end).format('MMM D LT')}`}]}};
                }
              } catch (e) {
                console.error(e);
                return {output: {elements: [{text: 'Post has been deleted :('}]}};
              }
            }
          },
          reportPost: {
            test: [data.action === 'report', !!data.post],
            process: async() => {
              console.warn('!REPORT!', data.post);
              return {output: {elements: [{text: 'The post has been reported for review.'}]}};
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
            test: /^(quit|clear|reset|exit|end)/ig,
            process: async() => ({output: {elements: [{text: 'Ok'}]}}),
            transitionTo: Freedaa.State.SASSY
          },
          help: {
            test: /^help$/ig,
            process: async() => ({output: {elements: [{text: 'Just send me your location to begin.'}]}})
          },
          checkOptin: {
            test: [context.started, !!optin],
            process: async() => ({output: {elements: [{text: 'You are already signed up! Just send me your location to begin.'}]}})
          }
        }
      },
      [Freedaa.State.SEARCH]: {
        process: async() => {
          const currTime = await adapters.getCurrentTime(context.location);
          const posts = await adapters.getPosts(context.location, currTime);
          const address = await adapters.getAddressFromCoordinates([context.location.lat, context.location.long]);

          if (!posts.length) {
            const {notifications} = await adapters.getUserNotificationOption(context.uid);

            if (!notifications) {
              return {
                output: {
                  elements: [{
                    text: `Sorry, I can't seem to find any food around you :( Do you want me to let you know when
                    someone finds free found?`,
                    buttons: [{text: 'Yeah! Notify me', data: {action: 'notifications', value: true}}]
                  }]
                }
              };
            }

            return {output: {elements: [{text: `Sorry, I can't seem to find any food around you - ${address} :(`}]}};
          }

          return {output: {elements: posts.map(post => this._formatPostToCard(post))}};
        },
        transitionTo: Freedaa.State.SASSY
      },
      [Freedaa.State.NOTIFICATIONS]: {
        process: async() => ({output: {elements: [{text: 'Do you want me to notify you if someone finds free food near you?'}]}}),
        transitions: {
          notifyMe: {
            test: /^(yes|yeah|yah|yee*?|y|yay*?)/ig,
            process: async() => {
              adapters.setUserNotificationOption(context.uid, true);
              return {output: {elements: [{text: 'I will hit you up then. Just type "notify" if you change your mind'}]}};
            },
            transitionTo: Freedaa.State.SASSY
          },
          dontNotifyMe: {
            test: /^(no|don'?t|nah*?|nay*?|n)/ig,
            process: async() => {
              adapters.setUserNotificationOption(context.uid, false);
              return {output: {elements: [{text: 'Ok. Just type "notify" if you change your mind'}]}};
            },
            transitionTo: Freedaa.State.SASSY
          },
          [FALLBACK]: {
            process: async() => ({output: {elements: [{text: 'Didn\'t really get you there. Yay or nay?'}]}})
          }
        }
      },
      [Freedaa.State.SUBMIT]: {
        process: async() => {
          const address = await adapters.getAddressFromCoordinates([context.location.lat, context.location.long]);

          context.postLocation = context.location;
          context.postDescription = null;
          context.postExpiration = null;
          context.postImage = null;
          context.postAddress = address;
          context.postState = 'description';
          context.postStart = null;
          context.postNational = false;

          return {
            output: {
              elements: [{text: `Where is the free food?`}],
              options: [
                {text: 'Near me', data: {action: 'local-post'}},
                {text: 'National', data: {action: 'national-post'}}
              ]
            }
          };
        },
        transitions: {
          isLocalDeal: {
            test: [data.action === 'local-post'],
            process: async() => ({transitionTo: Freedaa.State.POST})
          },
          isNationalDeal: {
            test: [data.action === 'national-post'],
            process: async() => {
              context.postNational = true;
              return {transitionTo: Freedaa.State.POST};
            }
          },
          [FALLBACK]: {
            process: async() => ({
              output: {
                elements: [{text: `Where is the free food? Gotta select one or the other :)`}],
                options: [
                  {text: 'Near me', data: {action: 'local-post'}},
                  {text: 'National', data: {action: 'national-post'}}
                ]
              }
            })
          }
        }
      },
      [Freedaa.State.POST]: {
        process: async() => {
          if (context.postNational) {
            return {output: {elements: [{text: `Ok. Tell me about the food and how to get it!`}]}}
          }

          return {output: {elements: [{text: `Cool! I got - ${context.postAddress}. Tell me about the food and how to get it!`}]}}
        },
        transitions: {
          addDescriptionThenRequestImage: {
            test: [!!text, !context.postDescription],
            process: async() => {
              context.postDescription = text;
              context.postState = 'image';

              return {output: {elements: [{text: `Now I just need a picture.`}]}};
            }
          },
          addImageThenRequestStart: {
            test: [!!images, !context.postImage, !!context.postDescription],
            process: async() => {
              context.postImage = images[0];
              context.postState = 'start';

              return {output: {elements: [{text: `Almost done! When does it start (like 9 am or a certain date)?`}]}};
            }
          },
          addStartThenRequestEnd: {
            test: [!!text, !!context.postDescription, !!context.postImage, !context.postStart],
            process: async() => {
              let date;

              try {
                const dates = await adapters.parseTime(text);

                if (dates.length) {
                  date = dates[0];
                }
              } catch (e) {
                console.log(e);

                throw new TraceError('Could not understand the date');
              }

              const currTime = await adapters.getCurrentTime(context.location);

              if (/(now)/gi.test(text)) {
                date = currTime;
              }

              if (date.getTime() < currTime.getTime()) {
                return {output: {elements: [{text: 'This event already happened...'}]}}
              }

              if (date.getTime() > currTime.getTime() + 60 * 60 * 1000 * 24 * 14) {
                return {output: {elements: [{text: 'You cannot make a post this early'}]}};
              }

              context.postStart = date;

              return {output: {elements: [{text: `Last step! When does it end (like 10 am or a certain date)?`}]}};

            }
          },
          addEndTimeAndFinalize: {
            test: [!!text, !!context.postDescription, !!context.postImage, !!context.postStart],
            process: async() => {
              let date;

              try {
                const dates = await adapters.parseTime(text);

                if (dates.length) {
                  date = dates[0];
                }
              } catch (e) {
                console.log(e);

                throw new TraceError('Could not understand the date');
              }

              if (context.postStart >= date.getTime()) {
                return {output: {elements: [{text: 'The end time is before the start time'}]}}
              }

              // if (date.getTime() - context.postStart < 60 * 1000 * 5) {
              //  return {output: {elements: [{text: `This event is less than 5 minutes?`}]}};
              // }

              if (date.getTime() - context.postStart > 60 * 60 * 1000 * 24 * 5) {
                return {output: {elements: [{text: 'You cannot make a post that lasts > 5 days'}]}};
              }

              try {
                const post = await adapters.addPost(context.uid, {
                  location: context.postLocation,
                  description: context.postDescription,
                  image: context.postImage,
                  start: context.postStart,
                  end: date,
                  national: context.postNational
                });

                return {
                  output: {
                    elements: [
                      {text: 'You are all set! We will notify you when your post is verified.'},
                      null,
                      this._formatPostToCard(post, [{text: 'Delete', data: {action: 'delete', post: post._id}}])
                    ]
                  },
                  transitionTo: Freedaa.State.SASSY
                };
              } catch (e) {
                console.error(e);
                return {output: {elements: [{text: 'I think you broke us!'}]}};
              }
            }
          },
          [FALLBACK]: {
            process: async() => {
              const state = context.postState;
              if (state === 'description' || state === 'period') {
                return {output: {elements: [{text: 'I need a text input'}]}};
              }

              return {output: {elements: [{text: 'Send me a picture'}]}};
            }
          }
        }
      },
      [Freedaa.State.SASSY]: {
        transitions: {
          sassy: {
            test: !!text,
            process: async() => ({output: {elements: [{text: await adapters.getSass(text, context.uid)}]}})
          },
          imageRejection: {
            test: !!images,
            process: async() => ({output: {elements: [{text: 'Sending me photos. Por que?'}]}})
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
              return {
                output: {
                  elements: [
                    {text: `Hey ${first}, my name is Freedaa and I can help you find free food around you.`},
                    null,
                    {text: 'Send me your location to begin or enter your zipcode.'}
                  ]
                }
              };
            }
          },
          tutorialLocation: {
            test: !!location,
            transitionTo: PROXY
          },
          [FALLBACK]: {
            process: async() => ({output: {elements: [{text: `Send me a location pin or enter your zipcode.`}]}})
          }
        }
      },
      [CATCH]: {
        process: async e => {
          console.log(e.stack);
          return {output: {elements: [{text: `Ummm. I think you broke us: ${e.message.substr(0, 200)}`}]}};
        }
      },
      [FALLBACK]: {
        transitions: {
          help: {
            test: /^\/help$/,
            process: async() => ({output: {elements: [{text: 'Help!'}]}})
          }
        }
      }
    }, this.context.state, text, this);

    const {output, next} = result;

    this.context.state = next;

    if (output && output.elements) {
      for (const element of output.elements) {
        if (element) {
          if (element.text) element.text = this._flattenText(element.text);
          if (element.subtext) element.subtext = this._flattenText(element.subtext);
        }
      }
    }

    if (output && output.options) {
      for (const option of output.options) {
        if (option.text) option.text = this._flattenText(option.text);
      }
    }

    return output;
  }

  _formatPostToCard(post, buttons = [
    {text: 'I want this food!', data: {action: 'lead', post: post._id}},
    {text: 'Report', data: {action: 'report', post: post._id}}
  ]) {
    const period = post.start - Date.now() > 60 * 60 * 1000 * 12 ?
      moment(post.start).format('MMM D') : `${moment(post.start).format('LT')} - ${moment(post.end).format('LT')}`;

    return {
      text: `${post.national ? 'NATIONAL - ' : ''}${post.description}`,
      subtext: `${period} · ${post.views} views`,
      image: post.image,
      buttons
    };
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
