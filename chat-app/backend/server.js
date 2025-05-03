// chat-app/backend/server.js
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import cors from 'cors';
import url from 'url'; // To parse query parameters from WebSocket URL

import Message from './models/Message.js';

dotenv.config(); // Load .env variables

const app = express();
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 5002;

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('ChatApp MongoDB Connected'))
    .catch(err => {
        console.error('ChatApp DB Connection Error:', err);
        process.exit(1);
    });

const server = http.createServer(app);

const wss = new WebSocketServer({ server });

const clients = new Map();

wss.on('connection', (ws, req) => {
    const parameters = url.parse(req.url, true).query;
    const token = parameters.token;

    if (!token) {
        console.log('Connection attempt failed: Token required.');
        ws.close(1008, 'Token required');
        return;
    }

    let decodedPayload;
    try {
        decodedPayload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        console.log(`Token verification failed: ${err.message}. Closing connection.`);
        ws.close(1008, 'Invalid or expired token');
        return;
    }

    const userId = decodedPayload.id;
    const userName = decodedPayload.name;
    const userLoginId = decodedPayload.user_id;

    if (!clients.has(userId)) {
        clients.set(userId, new Set());
    }
    clients.get(userId).add(ws);

    console.log(`Client authenticated and connected: ${userName} (ID: ${userId}, LoginID: ${userLoginId})`);

    ws.userInfo = { id: userId, name: userName, userLoginId: userLoginId };

    Message.find()
        .sort({ timestamp: -1 })
        .limit(50)
        .lean()
        .then(messages => {
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'history', payload: messages.reverse() }));
            }
        })
        .catch(err => console.error('Error fetching message history:', err));

    ws.on('message', async (messageBuffer) => {
        let messageData;
        try {
            messageData = JSON.parse(messageBuffer.toString());
        } catch (error) {
            console.error(`Failed to parse message from ${ws.userInfo.name}:`, messageBuffer.toString());
            ws.send(JSON.stringify({ type: 'error', payload: 'Invalid message format (not JSON).' }));
            return;
        }

        if (messageData.type === 'chatMessage' && messageData.payload?.text) {
            const text = messageData.payload.text.trim();
            if (!text) {
                console.log(`Ignoring empty message from ${ws.userInfo.name}.`);
                return;
            }

            const newMessage = new Message({
                senderId: ws.userInfo.id,
                senderUserId: ws.userInfo.userLoginId,
                senderName: ws.userInfo.name,
                text: text
            });

            try {
                const savedMessage = await newMessage.save();

                const broadcastData = JSON.stringify({
                    type: 'newMessage',
                    payload: savedMessage
                });

                console.log(`Broadcasting message from ${savedMessage.senderName}: ${savedMessage.text}`);
                clients.forEach((userConnections, clientId) => {
                    userConnections.forEach((clientWs) => {
                        if (clientWs.readyState === ws.OPEN) {
                            clientWs.send(broadcastData);
                        } else {
                            console.warn(`Client ${clientId} was not open during broadcast. Removing.`);
                            userConnections.delete(clientWs);
                            if (userConnections.size === 0) {
                                clients.delete(clientId);
                            }
                        }
                    });
                });

            } catch (dbError) {
                console.error(`Database error saving message from ${ws.userInfo.name}:`, dbError);
                ws.send(JSON.stringify({ type: 'error', payload: 'Failed to save message to database.' }));
            }
        } else {
            console.log(`Received unhandled message type or invalid format from ${ws.userInfo.name}:`, messageData);
            ws.send(JSON.stringify({ type: 'error', payload: 'Unhandled message type or format.' }));
        }
    });

    ws.on('close', (code, reason) => {
        const reasonString = reason ? reason.toString() : 'No reason given';
        console.log(`Client disconnected: ${ws.userInfo?.name || 'Unknown'} (ID: ${ws.userInfo?.id || 'N/A'}). Code: ${code}, Reason: ${reasonString}`);

        if (ws.userInfo?.id && clients.has(ws.userInfo.id)) {
            const userConnections = clients.get(ws.userInfo.id);
            userConnections.delete(ws);
            if (userConnections.size === 0) {
                clients.delete(ws.userInfo.id);
            }
        }
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for ${ws.userInfo?.name || 'Unknown'} (ID: ${ws.userInfo?.id || 'N/A'}):`, error);
        if (ws.userInfo?.id && clients.has(ws.userInfo.id)) {
            const userConnections = clients.get(ws.userInfo.id);
            userConnections.delete(ws);
            if (userConnections.size === 0) {
                clients.delete(ws.userInfo.id);
            }
        }
        try {
            ws.close(1011, "Internal server error");
        } catch (closeError) {
            console.error("Error trying to close WebSocket after error:", closeError);
        }
    });
});

console.log('WebSocket Server initialized and listening for connections.');

app.get('/', (req, res) => {
    res.send(`ChatApp Backend Running. Connected clients: ${clients.size}`);
});

server.listen(port, () => {
    console.log(`ChatApp Server (HTTP & WebSocket) listening at http://localhost:${port}`);
});