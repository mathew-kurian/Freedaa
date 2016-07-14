import mongoose from 'mongoose';

const {Schema} = mongoose;

const postSchema = new Schema({
  uid: {type: String, index: true, required: true},
  image: String,
  start: Date,
  views: {default: 1, type: Number},
  deleted: {default: false, type: Boolean},
  end: Date,
  global: Boolean,
  national: {default: false, type: Boolean},
  location: {type: [Number], index: '2d'},
  description: String,
  verified: {type: Boolean, default: false}
});

export default mongoose.model('post', postSchema);
