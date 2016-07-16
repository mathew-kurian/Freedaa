import mongoose from 'mongoose';

const {Schema} = mongoose;

const userSchema = new Schema({
  uid: {type: String, index: true, required: true, unique: true},
  deleted: {type: Boolean, default: false},
  first: String,
  last: String,
  email: String,
  location: {type: [Number], index: '2d'},
  notifications: {type: Boolean, default: true},
  context: Object
});

export default mongoose.model('user', userSchema);
