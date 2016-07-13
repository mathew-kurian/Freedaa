import User from '../../models/user.es6';
import {stripUndefNull} from '../../libs/utils.es6';

export async function create(uid, {first, last, email, context}) {
  return await (new User({uid, first, last, email, context}).save());
}

export async function find(attrs = {}) {
  return await (User.find({...attrs, deleted: false}).exec());
}

export async function findByLocation({lat, long}, radiusKm) {
  return await (User.find({deleted: false})
    .sort('end')
    .where('location')
    .near({
      center: [long, lat],
      maxDistance: radiusKm / 111.12
    }).lean().exec());
}

export async function findOne(attrs = {}) {
  return await (User.findOne({...attrs, deleted: false}).exec());
}

export async function findByIdAndUpdate(uid, attrs = {}) {
  delete attrs._id;
  delete attrs.uid;
  attrs = stripUndefNull(attrs);
  return await (User.findOneAndUpdate({uid}, {$set: attrs}).exec());
}
