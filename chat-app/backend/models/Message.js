// chat-app/backend/models/Message.js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    senderId: { // Matches the '_id' field (MongoDB ObjectId) from the User model in auth-app
        type: mongoose.Schema.Types.ObjectId,
        // ref: 'User', // Optional: Ref only works easily if User model is in the same service or using specific libraries
        required: true
    },
    senderUserId: { // Matches the 'user_id' field (string identifier) from the User model
        type: String,
        required: true,
        trim: true
    },
    senderName: { // Store the name for easy display, obtained from JWT
        type: String,
        required: true,
        trim: true
    },
    text: {
        type: String,
        required: true,
        trim: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
    // Future enhancement: Add room/channel ID here
    // roomId: { type: String, required: true, index: true }
});

// Index for faster querying by timestamp (useful for fetching history)
messageSchema.index({ timestamp: 1 });
// Optional: Index for room ID if/when implemented
// messageSchema.index({ roomId: 1, timestamp: 1 });

export default mongoose.model('Message', messageSchema);