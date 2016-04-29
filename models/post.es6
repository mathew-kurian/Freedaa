import mongoose from 'mongoose';

const {Schema} = mongoose;

const postSchema = new Schema({
  userId: {type: String, index: true, required: true},
  image: String,
  start: Date,
  views: {default: 1, type: Number},
  deleted: {default: false, type: Boolean},
  end: Date,
  national: {default: false, type: Boolean},
  coordinates: {type: [Number], index: '2d'},
  description: String,
  verified: {type: Boolean, default: false}
});

export default mongoose.model('Post', postSchema);
