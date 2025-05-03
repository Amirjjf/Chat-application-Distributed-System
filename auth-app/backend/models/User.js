// backend/models/User.js
import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true, // includes index
    trim: true
  },
  password_hash: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true, // includes index
    trim: true,
    lowercase: true,
    match: [/\S+@\S+\.\S+/, 'Invalid email']
  },
  country: {
    type: String,
    required: true,
    trim: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  last_login: {
    type: Date,
    default: null
  },
  profile_pic_filename: {
    type: String,
    default: null
  }
});


export default mongoose.model('User', schema);
