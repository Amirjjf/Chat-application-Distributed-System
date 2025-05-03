import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import url from 'url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import Message from './models/Message.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5002;
const authGrpcAddress = process.env.AUTH_GRPC_SERVICE_ADDRESS || 'localhost:50051';

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('ChatApp MongoDB Connected (Main Thread)'))
    .catch(err => {
        console.error('ChatApp DB Connection Error:', err);
        process.exit(1);
    });

const PROTO_PATH = path.join(__dirname, 'protos/auth.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});
const authProto = grpc.loadPackageDefinition(packageDefinition).auth;
const authServiceClient = new authProto.AuthService(
    authGrpcAddress, grpc.credentials.createInsecure()
);
console.log(`AuthService gRPC client connecting to: ${authGrpcAddress}`);

function verifyTokenWithAuthService(token) {
    return new Promise((resolve, reject) => {
        authServiceClient.verifyToken({ token: token }, (err, response) => {
            if (err) {
                console.error('[gRPC Client] Error verifying token:', err);
                return reject(new Error(`gRPC Connection Error: ${err.details || err.message}`));
            }
            if (response.error) {
                 console.log(`[gRPC Client] Token verification failed: ${response.error}`);
                 return reject(new Error(response.error));
            }
            if (response.user_info) {
                 console.log(`[gRPC Client] Token verified successfully for user: ${response.user_info.name}`);
                 return resolve(response.user_info);
            }
            console.error('[gRPC Client] Invalid response structure from AuthService:', response);
            return reject(new Error('Invalid response structure received from authentication service.'));
        });
    });
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Map();

wss.on('connection', async (ws, req) => {
    const parameters = url.parse(req.url, true).query;
    const token = parameters.token;

    console.log('Client attempting connection...');
    if (!token) {
        console.log('Connection failed: Token required.');
        ws.close(1008, 'Token required');
        return;
    }

    let userInfo;
    try {
        userInfo = await verifyTokenWithAuthService(token);
    } catch (err) {
        console.log(`Authentication failed via gRPC: ${err.message}. Closing connection.`);
        ws.close(4001, `Authentication failed: ${err.message || 'Invalid credentials'}`);
        return;
    }

    const userId = userInfo.id;
    const userName = userInfo.name;
    const userLoginId = userInfo.user_login_id;

    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId).add(ws);
    ws.userInfo = { id: userId, name: userName, userLoginId: userLoginId };
    console.log(`Client connected: ${userName} (ID: ${userId}, LoginID: ${userLoginId})`);

    try {
        const messages = await Message.find().sort({ timestamp: -1 }).limit(50).lean();
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'history', payload: messages.reverse() }));
        }
    } catch (err) {
        console.error('Error fetching history:', err);
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'error', payload: 'Could not load history.' }));
        }
    }

    ws.on('message', (messageBuffer) => {
        if (!ws.userInfo) {
            console.warn("Received message from connection without userInfo after successful auth. Ignoring.");
            return;
        }

        let data;
        try {
            data = JSON.parse(messageBuffer.toString());
        } catch (e) {
             console.error(`Failed to parse message from ${ws.userInfo.name}:`, messageBuffer.toString());
            if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'error', payload: 'Invalid JSON format.' }));
            return;
        }

        if (data.type === 'chatMessage' && data.payload?.text) {
            const text = data.payload.text.trim();
            if (!text) {
                 console.log(`Ignoring empty message from ${ws.userInfo.name}.`);
                 return;
            }

            const workerPath = path.resolve(__dirname, 'messageWorker.js');
            const worker = new Worker(workerPath);
            worker.postMessage({ senderInfo: ws.userInfo, text: text });

            worker.on('message', ({ type, message, error }) => {
                if (type === 'success' && message) {
                    const payload = JSON.stringify({ type: 'newMessage', payload: message });
                    console.log(`Broadcasting message saved by worker: ${message.text}`);
                    clients.forEach((userConnections, targetUserId) => {
                        userConnections.forEach(clientWs => {
                            if (clientWs.readyState === ws.OPEN) {
                                clientWs.send(payload);
                            } else {
                                console.warn(`Client ${clientWs.userInfo?.name || targetUserId} was not open during broadcast. Removing.`);
                                userConnections.delete(clientWs);
                                if (userConnections.size === 0) { clients.delete(targetUserId); }
                            }
                        });
                    });
                } else if (type === 'error') {
                    console.error(`Worker error saving message for ${ws.userInfo.name}:`, error);
                    if (ws.readyState === ws.OPEN) { ws.send(JSON.stringify({ type: 'error', payload: `Failed to save message: ${error}` })); }
                }
            });

            worker.on('error', err => {
                console.error(`Worker thread error for ${ws.userInfo.name}:`, err);
                if (ws.readyState === ws.OPEN) { ws.send(JSON.stringify({ type: 'error', payload: 'Internal server error processing message.' })); }
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`Worker stopped with exit code ${code} for user ${ws.userInfo.name}`);
                } else {
                    console.log(`Worker finished successfully for user ${ws.userInfo.name} (Exit code 0)`);
                }
            });

        } else {
             console.log(`Received unhandled message type or invalid format from ${ws.userInfo.name}:`, data);
             if (ws.readyState === ws.OPEN) { ws.send(JSON.stringify({ type: 'error', payload: 'Unhandled message type or invalid format.' })); }
        }
    });

    const cleanup = () => {
        if (ws.userInfo?.id) {
            const userConnections = clients.get(ws.userInfo.id);
            if (userConnections) {
                userConnections.delete(ws);
                console.log(`WebSocket connection closed for ${ws.userInfo.name}. Remaining connections for user: ${userConnections.size}`);
                if (userConnections.size === 0) {
                    console.log(`Last connection closed for ${ws.userInfo.name}. Removing user from active clients.`);
                    clients.delete(ws.userInfo.id);
                }
            } else {
                 console.log(`Cleanup called for ${ws.userInfo.name}, but no connections found in map.`);
            }
        } else {
             console.log("WebSocket connection closed for a user without userInfo (likely failed auth or early disconnect).");
        }
    };

    ws.on('close', (code, reason) => {
        const reasonString = reason ? reason.toString() : 'No reason given';
        console.log(`Client close event: ${ws.userInfo?.name || 'Unknown'}. Code: ${code}, Reason: ${reasonString}`);
        cleanup();
    });

    ws.on('error', err => {
        console.error(`WebSocket error event for ${ws.userInfo?.name || 'Unknown'}:`, err);
        cleanup();
        try {
            if (ws.readyState !== ws.CLOSED && ws.readyState !== ws.CLOSING) { ws.close(1011, "WebSocket error occurred"); }
        } catch (closeError) { console.error("Error trying to close WebSocket after error event:", closeError); }
    });
});

app.get('/', (req, res) => {
    const activeUserIds = Array.from(clients.keys());
    res.send(`ChatApp Backend Running. Active user count: ${activeUserIds.length}`);
});

server.listen(port, () => {
    console.log(`ChatApp Server (HTTP & WebSocket) listening at http://localhost:${port}`);
});