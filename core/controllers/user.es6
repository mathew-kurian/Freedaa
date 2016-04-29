import * as User from '../models/user.es6';

export async function createUser(userId, {first, last, email, context}) {
  return await User.createUser(userId, {first, last, email, context});
}

export async function getUserById(userId) {
  return await User.findOne({userId});
}

export async function updateUser(userId, attrs) {
  try {
    return await User.findByIdAndUpdate(userId, attrs);
  } catch (e) {
    throw new TraceError('Could not updateUser', e);
  }
}
