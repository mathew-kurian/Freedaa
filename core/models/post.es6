import Post from '../../models/post.es6';

export async function create(userId, {description, coordinates: {lat, long}, start, end, image}) {
  return await (new Post({userId, description, coordinates: [lat, long], image, start, end}).save());
}

export async function findByLocation({lat, long}, radiusKm, valid = true) {
  try {
    await (Post.update(valid ? {verified: true, deleted: false, end: {$gt: new Date()}} :
               {deleted: false}, {$inc: {views: 1}}, {multi: true, new: true})
               .where('coordinates')
               .near({
                 center: [lat, long],
                 maxDistance: radiusKm / 111.12
               }).lean().exec());
  } catch (e) {
    // ignore
  }

  return await (Post.find(valid ? {verified: true, deleted: false, end: {$gt: new Date()}} : {})
                    .where('coordinates')
                    .near({
                      center: [lat, long],
                      maxDistance: radiusKm / 111.12
                    }).lean().exec());
}

export async function findById(id) {
  return await (Post.findOne({_id: id, deleted: false}).lean().exec());
}

export async function findAndUpdate(id, attrs = {}) {
  const post = await (Post.findOne({_id: id, deleted: false}).exec());

  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'deleted') {
      continue;
    }

    post[k] = v;
  }

  await post.save();

  return post.lean();
}

export async function find(attrs = {}, valid = true) {
  try {
    await (Post.update({...attrs, deleted: false, ...(valid ? {verified: true} : {})}, {$inc: {views: 1}}, {
      multi: true,
      new: true
    }).exec());
  } catch (e) {
    // ignore
  }

  return await (Post.find({...attrs, deleted: false, ...(valid ? {verified: true} : {})}).exec());
}

export async function findOne(attrs = {}) {
  return await (Post.findOne({...attrs, deleted: false}).exec());
}

export async function findByIdAndUpdate(id, attrs = {}) {
  delete attrs._id;
  return await (Post.findOneAndUpdate({_id: id, deleted: false}, {$set: attrs}).exec());
}

export async function remove(id) {
  return await Post.findOneAndUpdate({_id: id, deleted: false}, {deleted: true});
}
