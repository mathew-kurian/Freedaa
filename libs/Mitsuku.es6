import Promise from 'bluebird';
import cheerio from 'cheerio';
import superagent from 'superagent';

const ENDPOINT_CHAT_MITSUKU = 'https://kakko.pandorabots.com/pandora/talk?botid=f326d0be8e345a13&skin=chat';
const MESSAGE_REGEX = /(Mitsuku:(.*))/;
const MESSAGE_REJECT_REGEX = /(x(.*)x[^\s]+)|(\|)|(BYESPLIT X1234)/ig;
const MESSAGE_SENDER_TAG = 'You:';

export default class Mitsuku {
  constructor(options = {}) {
    this._tag = options.tag || 'Anonymous';
    this._agent = superagent.agent();
    this._endpoint = options.endpoint || ENDPOINT_CHAT_MITSUKU;
    this._name = options.name || 'Mitsuku';

    const agent = this._agent;
    const req = agent.get(ENDPOINT_CHAT_MITSUKU);
    agent.attachCookies(req);
    req.end((err, res) => {
      agent.saveCookies(res);
    });
  }

  async send(message) {
    return new Promise((resolve, reject) => {
      if (!message) {
        return reject(new Error('Message cannot be null or empty'));
      }

      message = message.replace(new RegExp(this._name, 'gi'), 'Mitsuku');

      const agent = this._agent;
      const endpoint = this._endpoint;

      let req;

      req = agent.post(endpoint);
      agent.attachCookies(req);
      req.set('Content-Type', 'application/x-www-form-urlencoded')
        .send({message})
        .end((err, res) => {
          if (err) {
            return reject(err);
          }
          agent.saveCookies(res);
          resolve(res.text);
        });
    }).then(html => {
      const conv = cheerio.load(html)('body').find('p').text().trim();
      const match = MESSAGE_REGEX.exec(conv);

      let message;
      let prevMessageStart;

      if (match && match.length > 0) {
        message = match[match.length - 1];
        prevMessageStart = message.indexOf(MESSAGE_SENDER_TAG);
        if (prevMessageStart != -1) {
          message = message.substr(0, prevMessageStart);
        }
        return message.replace(MESSAGE_REJECT_REGEX, '').trim();
      } else {
        throw new Error("Could not parse Mitsuku response");
      }
    }).then(response => response.replace(/(Mitsuku)/gi, this._name));
  }

  getTag() {
    return this._tag;
  }

  toString() {
    return this.getTag();
  }
}
