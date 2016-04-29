import User from '../../models/user.es6';
import {stripUndefNull} from '../../libs/utils.es6';

export async function createUser(userId, {first, last, email, context}) {
  return await User.create({userId, first, last, email, context});
}

export async function find(attrs = {}) {
  return await (User.find({...attrs, deleted: false}).exec());
}

export async function findOne(attrs = {}) {
  return await (User.findOne({...attrs, deleted: false}).exec());
}

export async function findByIdAndUpdate(userId, attrs = {}) {
  delete attrs._id;
  delete attrs.userId;
  attrs = stripUndefNull(attrs);
  return await (User.findOneAndUpdate({userId}, {$set: attrs}).exec());
}
