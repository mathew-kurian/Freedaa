import {ContextStore} from './chatbot.es6';

export default class MemoryContextStore extends ContextStore {
  memoryDb = {};

  async read(uid) {
    return this.memoryDb[uid];
  }

  async write(uid, context) {
    this.memoryDb[uid] = context;
  }
}
