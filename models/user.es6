import mongoose from 'mongoose';

const {Schema} = mongoose;

const userSchema = new Schema({
  userId: {type: String, index: true, required: true, unique: true},
  deleted: {type: Boolean, default: false},
  first: String,
  last: String,
  email: String,
  coordinates: {type: [Number], index: '2d'},
  notifications: {type: Boolean, default: false},
  context: Object
});

export default mongoose.model('User', userSchema);
