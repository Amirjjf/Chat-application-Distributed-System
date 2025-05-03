
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    senderUserId: {
        type: String,
        required: true,
        trim: true
    },
    senderName: {
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
});

messageSchema.index({ timestamp: 1 });

export default mongoose.model('Message', messageSchema);