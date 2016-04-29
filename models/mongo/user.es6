import mongoose from 'mongoose';

const {Schema} = mongoose;

const userSchema = new Schema({
  facebookId: {
    type: String,
    index: true,
    required: true
  },
  location: String,
  context: Object
});

export default mongoose.model('User', userSchema);
