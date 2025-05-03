import { parentPort } from 'worker_threads';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Message from './models/Message.js';

dotenv.config();

let isConnected = false;
let connectionPromise = null;

async function connectDB() {
    if (isConnected) {
        return;
    }
    if (connectionPromise) {
        return connectionPromise;
    }
    console.log('[Worker] Attempting MongoDB connection...');
    connectionPromise = mongoose.connect(process.env.MONGO_URI)
        .then(mongooseInstance => {
            isConnected = true;
            connectionPromise = null;
            console.log('[Worker] MongoDB Connected');
            mongooseInstance.connection.on('disconnected', () => {
                isConnected = false;
                console.error('[Worker] MongoDB disconnected!');
            });
            return mongooseInstance;
        })
        .catch(err => {
            console.error('[Worker] MongoDB connection failed:', err.message);
            isConnected = false;
            connectionPromise = null;
            process.exit(1);
        });
    return connectionPromise;
}

parentPort.on('message', async ({ senderInfo, text }) => {
    let mongooseDisconnected = false;
    try {
        await connectDB();

        if (!isConnected) {
             throw new Error("Database not connected in worker.");
        }

        const message = new Message({
            senderId: senderInfo.id,
            senderUserId: senderInfo.userLoginId,
            senderName: senderInfo.name,
            text: text
        });

        const savedMessage = await message.save();
        let plainMessageObject = savedMessage.toObject();

        if (plainMessageObject._id && typeof plainMessageObject._id !== 'string') {
            plainMessageObject._id = plainMessageObject._id.toString();
        }
        if (plainMessageObject.senderId && typeof plainMessageObject.senderId !== 'string') {
            plainMessageObject.senderId = plainMessageObject.senderId.toString();
        }

        parentPort.postMessage({ type: 'success', message: plainMessageObject });

        console.log('[Worker] Disconnecting from MongoDB...');
        await mongoose.disconnect();
        mongooseDisconnected = true;
        console.log('[Worker] MongoDB disconnected gracefully.');

    } catch (err) {
        console.error('[Worker] Error processing message:', err);
        const errorMessage = (err instanceof Error) ? err.message : String(err);
        parentPort.postMessage({ type: 'error', error: errorMessage });

        if (isConnected && !mongooseDisconnected) {
             try {
                 console.log('[Worker] Disconnecting from MongoDB after error...');
                 await mongoose.disconnect();
                 console.log('[Worker] MongoDB disconnected after error.');
             } catch (disconnectErr) {
                 console.error('[Worker] Error disconnecting from MongoDB after error:', disconnectErr);
             }
        }
    }
});

console.log('[Worker] Message worker started.');