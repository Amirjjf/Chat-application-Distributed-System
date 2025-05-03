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
app.use(cors()); // Enable CORS for potential future REST endpoints
app.use(express.json()); // Parse JSON bodies for potential future REST endpoints
const port = process.env.PORT || 5002; // Use port from .env

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('ChatApp MongoDB Connected'))
    .catch(err => {
        console.error('ChatApp DB Connection Error:', err);
        process.exit(1); // Exit if DB connection fails
    });

// --- HTTP Server Setup ---
// WebSocket needs an HTTP server to attach to, even if Express isn't serving many HTTP routes.
const server = http.createServer(app);

// --- WebSocket Server Setup ---
const wss = new WebSocketServer({ server }); // Attach WebSocket server to the HTTP server

// --- Client Tracking ---
// Use a Map to store connected clients: Map<userId (MongoDB _id), Set<WebSocket instances>>
const clients = new Map();

// --- WebSocket Connection Logic ---
wss.on('connection', (ws, req) => {
    // 1. Authenticate Connection using JWT from query parameter
    const parameters = url.parse(req.url, true).query;
    const token = parameters.token;

    if (!token) {
        console.log('Connection attempt failed: Token required.');
        ws.close(1008, 'Token required'); // 1008 = Policy Violation
        return;
    }

    let decodedPayload;
    try {
        // Verify the token using the SAME secret key as auth-app
        decodedPayload = jwt.verify(token, process.env.JWT_SECRET);
        // decodedPayload should contain { id: 'mongodb_object_id', user_id: 'string_id', name: 'User Name', ... }
    } catch (err) {
        console.log(`Token verification failed: ${err.message}. Closing connection.`);
        ws.close(1008, 'Invalid or expired token'); // Use 1008 Policy Violation
        return;
    }

    // 2. Authentication Successful - Store Client
    const userId = decodedPayload.id; // MongoDB _id
    const userName = decodedPayload.name;
    const userLoginId = decodedPayload.user_id; // User-defined string ID

    // Allow multiple connections per user
    if (!clients.has(userId)) {
        clients.set(userId, new Set());
    }
    clients.get(userId).add(ws);

    console.log(`Client authenticated and connected: ${userName} (ID: ${userId}, LoginID: ${userLoginId})`);

    // Add user info to the ws object itself for easier access in message handlers
    ws.userInfo = { id: userId, name: userName, userLoginId: userLoginId };

    // 3. Send Recent Chat History (Optional)
    Message.find()
        .sort({ timestamp: -1 }) // Get latest messages first
        .limit(50)               // Limit the number of messages
        .lean()                  // Use lean for performance if not modifying docs
        .then(messages => {
            if (ws.readyState === ws.OPEN) {
                 // Reverse messages to send them in chronological order (oldest first)
                ws.send(JSON.stringify({ type: 'history', payload: messages.reverse() }));
            }
        })
        .catch(err => console.error('Error fetching message history:', err));

    // 4. Handle Messages Received FROM this Client
    ws.on('message', async (messageBuffer) => {
        let messageData;
        try {
            messageData = JSON.parse(messageBuffer.toString());
        } catch (error) {
            console.error(`Failed to parse message from ${ws.userInfo.name}:`, messageBuffer.toString());
            ws.send(JSON.stringify({ type: 'error', payload: 'Invalid message format (not JSON).' }));
            return;
        }

        // Process only expected message types
        if (messageData.type === 'chatMessage' && messageData.payload?.text) {
            const text = messageData.payload.text.trim();
            if (!text) {
                console.log(`Ignoring empty message from ${ws.userInfo.name}.`);
                return; // Ignore empty messages
            }

            // Create message object using authenticated user info attached to ws
            const newMessage = new Message({
                senderId: ws.userInfo.id,
                senderUserId: ws.userInfo.userLoginId,
                senderName: ws.userInfo.name,
                text: text
            });

            try {
                // Save message to the database
                const savedMessage = await newMessage.save();

                // Broadcast the NEW message to ALL connected clients
                const broadcastData = JSON.stringify({
                    type: 'newMessage',
                    payload: savedMessage // Send the complete saved message object
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

    // 5. Handle Client Disconnection
    ws.on('close', (code, reason) => {
        const reasonString = reason ? reason.toString() : 'No reason given';
        console.log(`Client disconnected: ${ws.userInfo?.name || 'Unknown'} (ID: ${ws.userInfo?.id || 'N/A'}). Code: ${code}, Reason: ${reasonString}`);

        // Remove the WebSocket instance from the user's set of connections
        if (ws.userInfo?.id && clients.has(ws.userInfo.id)) {
            const userConnections = clients.get(ws.userInfo.id);
            userConnections.delete(ws);
            if (userConnections.size === 0) {
                clients.delete(ws.userInfo.id); // Remove the user if no connections remain
            }
        }

        // Optional: Broadcast a 'user left' message to other clients
        // broadcastUserList(); // Function to send updated user list
    });

    // 6. Handle WebSocket Errors
    ws.on('error', (error) => {
        console.error(`WebSocket error for ${ws.userInfo?.name || 'Unknown'} (ID: ${ws.userInfo?.id || 'N/A'}):`, error);
        // Ensure client is removed on error as well, as 'close' might not fire reliably
        if (ws.userInfo?.id && clients.has(ws.userInfo.id)) {
            const userConnections = clients.get(ws.userInfo.id);
            userConnections.delete(ws);
            if (userConnections.size === 0) {
                clients.delete(ws.userInfo.id);
            }
        }
        try {
            // Attempt to close the connection gracefully if possible
            ws.close(1011, "Internal server error"); // 1011 = Internal Error
        } catch (closeError) {
            console.error("Error trying to close WebSocket after error:", closeError);
        }
    });
});

console.log('WebSocket Server initialized and listening for connections.');

// --- Basic HTTP Route (Optional - for health checks, etc.) ---
app.get('/', (req, res) => {
    res.send(`ChatApp Backend Running. Connected clients: ${clients.size}`);
});

// --- Start the HTTP Server (which hosts the WebSocket Server) ---
server.listen(port, () => {
    console.log(`ChatApp Server (HTTP & WebSocket) listening at http://localhost:${port}`);
});

// Optional: Add graceful shutdown logic here (handle SIGINT, SIGTERM)