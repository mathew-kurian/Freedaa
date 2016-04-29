import mongoose from 'mongoose';

const {Schema} = mongoose;

const postSchema = new Schema({
  userId: {
    type: String,
    index: true,
    required: true
  },
  photo: String,
  description: String
});

export default mongoose.model('Post', postSchema);
