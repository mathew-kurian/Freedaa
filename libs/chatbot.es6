export class Context {
  uid = null;

  constructor(uid) {
    if (!uid) {
      throw Error('UID is required!');
    }

    this.uid = uid;
  }

  set(key, value) {
    if (key === 'uid') {
      throw Error('UID is readonly!');
    }

    this[key] = value;

    return this;
  }
}

function parse(attributes, data) {
  const parsed = Object.create(null);

  for (const attr of Object.keys(data || {})) {
    if (!(attr in data)) throw new TraceError(`Parse error; could not find attribute '${attr}'`, data);
    parsed[attr] = data[attr];
  }

  return parsed;
}

function parseArray(attributes, data) {
  if (Array.isArray(data)) {
    return data.map(a => parse(attributes, a));
  }

  return [];
}

class Func {
  static parse(attributes) {
    return fn => (...args) => parse(attributes, fn(...args));
  }

  static parseArray(attributes) {
    return fn => (...args) => parseArray(attributes, fn(...args));
  }
}

class Async {
  static any() {
    return fn => async (...args) => await fn(...args);
  }

  static parse(attributes) {
    return fn => async (...args) => parse(attributes, await fn(...args));
  }

  static parseArray(attributes) {
    return fn => async (...args) => parseArray(attributes, await fn(...args));
  }
}

export const Types = {
  Async,
  Func
};

const botInstanceActions = new WeakMap();

export class Bot {
  static botname = 'Bot';
  static version = NaN;

  constructor(dispatcher, context, adapters, actions, extras) {
    this.dispatcher = dispatcher;
    this.context = context;
    this.adapters = adapters;
    this.extras = extras;
    this.actions = actions;
  }

  registerAction(event, handler, actions = {}, adapters = {}, extras = {}) {
    if (!botInstanceActions.has(this)) {
      botInstanceActions.set(this, {});
    }

    const events = botInstanceActions.get(this);

    events[event] = {handler, adapters, actions, extras};
  }

  async dispatch(event, ...args) {
    // console.tag('chat-bot', 'dispatcher').log(this.constructor.botname, event);

    return await this.dispatcher._dispatchBot(this, event, ...args);
  }
}

export class ContextStore {
  async read(uid) {
    throw Error('Not implemented', uid);
  }

  async write(uid, context) {
    throw Error('Not implemented', uid, context);
  }
}

/**
 * Chatbot Dispatcher
 */
export class ChatBotDispatcher {
  constructor(store) {
    this.bots = new Map();
    this.defaultBot = null;
    this.store = store;
  }

  registerBot(BotImpl, actions, adapters, extras = {}) {
    adapters = this._typeCheck(adapters, BotImpl.adapterTypes);
    actions = this._typeCheck(actions, BotImpl.actionTypes);

    const bot = {Bot: BotImpl, adapters, actions, extras};
    this.bots.set(BotImpl.botname + BotImpl.version, bot);
    this.defaultBot = bot;
  }

  async _createContext(BotImpl, uid) {
    const context = BotImpl.createContext(uid);
    context.botname = BotImpl.botname;
    context.version = BotImpl.version;

    return context;
  }

  _typeCheck(parseable, types) {
    const checked = Object.create(null);

    for (const [k, v] of Object.entries(types)) {
      if (k in parseable) {
        checked[k] = v(parseable[k]);
      }
    }

    return checked;
  }

  async _getScopedBot(uid, context) {
    if (!context || !Object.keys(context).length) {
      context = await this._createContext(this.defaultBot.Bot, uid);
    }

    const {botname, version} = context;
    if (!this.bots.has(botname + version)) {
      throw Error(`Could not find bot ${botname}@${version}`);
    }

    const {adapters, actions, extras, Bot: BotImpl} = this.bots.get(botname + version);

    context = Object.assign(await this._createContext(BotImpl, uid), context);

    return new BotImpl(this, context, adapters, actions, extras);
  }

  async _dispatchBot(bot, event, ...args) {
    // _console.log('Pre-dispatch', event);

    let {handler: Handler, adapters, actions} = (botInstanceActions.get(bot) || {})[event];
    let key = '';

    while (Bot.prototype.isPrototypeOf(Handler.prototype)) {
      key += Handler.name + Handler.version;

      let subContext = bot.context[key];

      if (!subContext) {
        subContext = await this._createContext(Handler, bot.context.uid);
        bot.context[key] = subContext;
      }

      const childBot = new Handler(this, subContext,
        adapters = Object.assign(bot.adapters, adapters), actions = Object.assign(bot.actions, actions), bot.extras);

      const childBotActions = (botInstanceActions.get(childBot) || {})[event];
      let _actions = childBotActions.actions || {};
      let _adapters = childBotActions.adapters || {};

      _actions = this._typeCheck(_actions, Handler.adapterTypes);
      _adapters = this._typeCheck(_adapters, Handler.actionTypes);

      Handler = childBotActions.handler;
      adapters = Object.assign(adapters, _actions);
      actions = Object.assign(actions, _adapters);
      bot = childBot;
    }

    // _console.log('Post-dispatch', event, typeof Handler);

    return await Handler.bind(bot)(...args);
  }

  async dispatch(event, uid, ...args) {
    const context = await this.store.read(uid);
    const bot = await this._getScopedBot(uid, context);
    const output = await this._dispatchBot(bot, event, ...args);

    await this.store.write(uid, bot.context);

    return output;
  }
}
