import * as User from '../models/user.es6';

export async function createUser(uid, {first, last, email, context}) {
  return await User.create(uid, {first, last, email, context});
}

export async function getUserById(uid) {
  return await User.findOne({uid});
}

export async function updateUser(uid, attrs) {
  try {
    return await User.findByIdAndUpdate(uid, attrs);
  } catch (e) {
    throw new TraceError('Could not updateUser', e);
  }
}
