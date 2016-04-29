import keyMirror from 'keymirror';
import {Bot, Context, Types} from '../chat-bot.es6';
import {isEmpty} from '../utils.es6';
import * as fsm from './fsm.es6';
import PythonShell from 'python-shell';

/**
 * Sample Script
 * -------------
 *
 * 1. Hey whats up!
 * 2. (Find free food|I want free food|Where is free food) [Submit|Search]
 * 3. (I found free food|Post free food|Here is free fod)
 *
 * Search, Submit, Notification
 *
 */

export default class Freedaa extends Bot {
  static Context = class extends Context {
    state = Freedaa.State.START;
  };

  static botname = 'Freedaa';
  static version = 1;

  static Actions = keyMirror({TEXT_INPUT: null});
  static State = keyMirror({START: null, SEARCH: null, SUBMIT: null});

  static actionTypes = {onOrderCheckout: Types.Async.any()};
  static adapterTypes = {};

  static createContext = (uid) => new Freedaa.Context(uid);

  constructor(...args) {
    super(...args);

    this.registerAction(Actions.TEXT_INPUT, this.onTextInput);
  }

  async onTextInput(input) {
    if (isEmpty(input)) {
      return 'No text input';
    }

    const result = await fsm.step({
      [fsm.PROXY]: {
        transitions: {
          help: {
            test: /^help$/ig,
            process: async () => ```
            Type "free-food" to show the options
            ```
          }
        }
      },
      [Freedaa.State.START]: {
        transitions: {
          introduction: {
            test: /start/g,
            process: async () =>
            `Yo, my name is Freedaa and I am here get you free food. It's quite simple! When your hungry,` +
            `just tell me. If you find free food, tell me as well. And if you are eating alone, just talk to me.` +
            `Sending me your location starts the process.`
          },
          test2: {
            test: /.*?/g,
            process: async () => {
              const {context} = this;
              if (!context.started) {
                context.started = true;
                return 'Hey whats up!!! Type "start" to begin';
              }
            }
          },
          test3: {
            test: fsm.FALLBACK,
            process: async() => {
              return 'Are you sure you typed in correctly?';
            }
          }
        }
      },
      [fsm.CATCH]: {
        process: async(e) => {
          return `global error
    !${e.message}`;
        }
      },
      [fsm.FALLBACK]: {
        transitions: {
          help: {
            test: /^\/help$/,
            process: async () => 'Help!'
          }
        }
      }
    }, this.context.state, input);

    this.context.state = result.next;

    return result.output;
  }
}
