import Post from '../../models/post.es6';

export async function create(uid, {description, location: {lat, long}, start, end, image, national}) {
  return await (new Post({uid, description, location: [long, lat], image, start, end, national}).save());
}

export async function findByLocation({lat, long}, radiusKm, date, valid = true) {
  try {
    await (Post.update(valid ? {verified: true, deleted: false, national: false, end: {$gt: new Date(date)}} :
    {deleted: false}, {$inc: {views: 1}}, {multi: true, new: true})
      .sort('end')
      .where('location')
      .near({
        center: [long, lat],
        maxDistance: radiusKm / 111.12
      }).lean().exec());
  } catch (e) {
    // ignore
  }

  return await (Post.find(valid ? {verified: true, deleted: false, national: false, end: {$gt: new Date(date)}} : {})
    .sort('end')
    .where('location')
    .near({
      center: [long, lat],
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
    }).sort('end').exec());
  } catch (e) {
    // ignore
  }

  return await (Post.find({...attrs, deleted: false, ...(valid ? {verified: true} : {})}).sort('end').lean().exec());
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
