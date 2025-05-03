// chat-app/backend/server.js
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import mongoose from 'mongoose';
// import jwt from 'jsonwebtoken'; // NO LONGER NEEDED HERE
import dotenv from 'dotenv';
import cors from 'cors';
import url from 'url';
import grpc from '@grpc/grpc-js'; // Import gRPC
import protoLoader from '@grpc/proto-loader'; // Import protoLoader
import path from 'path'; // Import path
import { fileURLToPath } from 'url'; // For __dirname equivalent

import Message from './models/Message.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 5002;
const authGrpcAddress = process.env.AUTH_GRPC_SERVICE_ADDRESS || 'localhost:50051';

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('ChatApp MongoDB Connected'))
    .catch(err => {
        console.error('ChatApp DB Connection Error:', err);
        process.exit(1);
    });

// --- gRPC Client Setup ---
const PROTO_PATH = path.join(__dirname, 'protos/auth.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const authProto = grpc.loadPackageDefinition(packageDefinition).auth;

// Create gRPC client (unsecured connection)
const authServiceClient = new authProto.AuthService(
    authGrpcAddress,
    grpc.credentials.createInsecure()
);
console.log(`AuthService gRPC client connecting to: ${authGrpcAddress}`);

// Function to verify token via gRPC
const verifyTokenWithAuthService = (token) => {
    return new Promise((resolve, reject) => {
        authServiceClient.verifyToken({ token: token }, (err, response) => {
            if (err) {
                console.error('[gRPC Client] Error verifying token:', err);
                return reject(new Error(`gRPC Error: ${err.details || err.message}`));
            }
            if (response.error) {
                console.log(`[gRPC Client] Token verification failed: ${response.error}`);
                return reject(new Error(response.error)); // Reject with the error message from auth service
            }
            if (response.user_info) {
                console.log(`[gRPC Client] Token verified successfully for user: ${response.user_info.name}`);
                return resolve(response.user_info); // Resolve with user info
            }
            // Should not happen based on proto definition, but handle defensively
            console.error('[gRPC Client] Invalid response from AuthService:', response);
            return reject(new Error('Invalid response received from authentication service.'));
        });
    });
};


// --- WebSocket Server Setup ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Map(); // Map<userId (string), Set<WebSocket>>

wss.on('connection', async (ws, req) => {
    const parameters = url.parse(req.url, true).query;
    const token = parameters.token;

    console.log('Client attempting connection...');

    if (!token) {
        console.log('Connection failed: Token required.');
        ws.close(1008, 'Token required'); // 1008: Policy Violation
        return;
    }

    let userInfo;
    try {
        // Verify token using the gRPC call
        userInfo = await verifyTokenWithAuthService(token);
        // userInfo now contains { id, user_login_id, name, profile_pic_filename }
    } catch (err) {
        console.log(`Authentication failed via gRPC: ${err.message}. Closing connection.`);
        // Use 4001 for custom app-level auth failure, or stick to 1008
        ws.close(4001, `Authentication failed: ${err.message}`);
        return;
    }

    // --- User is authenticated ---
    const userId = userInfo.id; // Use MongoDB _id as the unique identifier
    const userName = userInfo.name;
    const userLoginId = userInfo.user_login_id; // Keep the original user_id if needed

    if (!clients.has(userId)) {
        clients.set(userId, new Set());
    }
    clients.get(userId).add(ws);

    console.log(`Client authenticated and connected: ${userName} (ID: ${userId}, LoginID: ${userLoginId})`);

    // Store user info on the WebSocket object
    ws.userInfo = { id: userId, name: userName, userLoginId: userLoginId };

    // Send message history
    try {
        const messages = await Message.find()
            .sort({ timestamp: -1 })
            .limit(50)
            .lean();
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'history', payload: messages.reverse() }));
        }
    } catch (err) {
        console.error('Error fetching message history:', err);
        // Optionally send an error to the client
        if (ws.readyState === ws.OPEN) {
             ws.send(JSON.stringify({ type: 'error', payload: 'Could not load message history.' }));
        }
    }

    // Handle incoming messages from this client
    ws.on('message', async (messageBuffer) => {
        if (!ws.userInfo) {
             console.warn("Received message from a connection without userInfo. Ignoring.");
             return; // Should not happen if auth succeeded
        }

        let messageData;
        try {
            messageData = JSON.parse(messageBuffer.toString());
        } catch (error) {
            console.error(`Failed to parse message from ${ws.userInfo.name}:`, messageBuffer.toString());
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'error', payload: 'Invalid message format (not JSON).' }));
            }
            return;
        }

        if (messageData.type === 'chatMessage' && messageData.payload?.text) {
            const text = messageData.payload.text.trim();
            if (!text) {
                console.log(`Ignoring empty message from ${ws.userInfo.name}.`);
                return;
            }

            // Create message using authenticated user info
            const newMessage = new Message({
                senderId: ws.userInfo.id, // Use the MongoDB _id
                senderUserId: ws.userInfo.userLoginId, // Keep original user_id if needed for display/frontend logic
                senderName: ws.userInfo.name,
                text: text
            });

            try {
                const savedMessage = await newMessage.save();

                // Broadcast the saved message (which includes the _id and timestamp)
                const broadcastData = JSON.stringify({
                    type: 'newMessage',
                    payload: savedMessage // Send the full saved message object
                });

                console.log(`Broadcasting message from ${savedMessage.senderName}: ${savedMessage.text}`);

                // Iterate through all connected clients/users
                clients.forEach((userConnections) => {
                    // Iterate through all connections for that user
                    userConnections.forEach((clientWs) => {
                        if (clientWs.readyState === ws.OPEN) {
                            clientWs.send(broadcastData);
                        } else {
                            // Clean up stale connections if found during broadcast
                            console.warn(`Client ${clientWs.userInfo?.name} was not open during broadcast. Removing.`);
                            userConnections.delete(clientWs);
                            if (userConnections.size === 0 && clientWs.userInfo?.id) {
                                clients.delete(clientWs.userInfo.id);
                            }
                        }
                    });
                });

            } catch (dbError) {
                console.error(`Database error saving message from ${ws.userInfo.name}:`, dbError);
                 if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({ type: 'error', payload: 'Failed to save message to database.' }));
                 }
            }
        } else {
            console.log(`Received unhandled message type or invalid format from ${ws.userInfo.name}:`, messageData);
             if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'error', payload: 'Unhandled message type or format.' }));
             }
        }
    });

    // Handle client disconnection
    ws.on('close', (code, reason) => {
        const reasonString = reason ? reason.toString() : 'No reason given';
        console.log(`Client disconnected: ${ws.userInfo?.name || 'Unknown'} (ID: ${ws.userInfo?.id || 'N/A'}). Code: ${code}, Reason: ${reasonString}`);

        if (ws.userInfo?.id && clients.has(ws.userInfo.id)) {
            const userConnections = clients.get(ws.userInfo.id);
            userConnections.delete(ws);
            if (userConnections.size === 0) {
                console.log(`Last connection for user ${ws.userInfo.name} closed. Removing user from active clients.`);
                clients.delete(ws.userInfo.id);
            }
        } else {
             console.log("Closed connection didn't have userInfo or wasn't in the clients map.");
        }
    });

    // Handle WebSocket errors
    ws.on('error', (error) => {
        console.error(`WebSocket error for ${ws.userInfo?.name || 'Unknown'} (ID: ${ws.userInfo?.id || 'N/A'}):`, error);
        // Error event is often followed by close, cleanup happens in 'close' handler
        // Attempt graceful close if possible, although it might already be closed
         try {
             if (ws.readyState !== ws.CLOSED && ws.readyState !== ws.CLOSING) {
                ws.close(1011, "Internal server error"); // 1011: Internal Error
             }
         } catch (closeError) {
             console.error("Error trying to close WebSocket after error:", closeError);
         }
         // Ensure cleanup even if close doesn't fire immediately after error
         if (ws.userInfo?.id && clients.has(ws.userInfo.id)) {
             const userConnections = clients.get(ws.userInfo.id);
             userConnections.delete(ws);
             if (userConnections.size === 0) {
                 clients.delete(ws.userInfo.id);
             }
         }
    });
});

console.log('WebSocket Server initialized and listening for connections.');

// Basic HTTP endpoint (optional)
app.get('/', (req, res) => {
    const activeUserIds = Array.from(clients.keys());
    res.send(`ChatApp Backend Running. Connected user IDs: ${activeUserIds.length > 0 ? activeUserIds.join(', ') : 'None'}`);
});

// Start the combined HTTP and WebSocket server
server.listen(port, () => {
    console.log(`ChatApp Server (HTTP & WebSocket) listening at http://localhost:${port}`);
});