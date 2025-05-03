// auth-app/backend/server.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken'; // Keep jwt for verification here
import grpc from '@grpc/grpc-js'; // Import gRPC
import protoLoader from '@grpc/proto-loader'; // Import protoLoader

import userRoutes from './routes/users.js';
import User from './models/User.js'; // Import User model if needed for future RPCs

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Express App Setup ---
const app = express();
const port = process.env.PORT || 5001;
const grpcPort = process.env.GRPC_PORT || 50051; // Get gRPC port from env

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('AuthApp MongoDB Connected'))
    .catch(err => {
        console.error('AuthApp DB Connection Error:', err);
        process.exit(1);
    });

// --- Express Routes ---
app.use('/api/users', userRoutes);
app.get('/', (_req, res) => res.send('AuthApp Backend (HTTP) Running'));

// --- Start Express Server ---
app.listen(port, () => {
    console.log(`AuthApp HTTP Server listening at http://localhost:${port}`);
});

// --- gRPC Server Setup ---
const PROTO_PATH = path.join(__dirname, 'protos/auth.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const authProto = grpc.loadPackageDefinition(packageDefinition).auth;

// gRPC Service Implementation
const verifyToken = (call, callback) => {
    const token = call.request.token;
    console.log(`[gRPC] Received VerifyToken request`);

    if (!token) {
        console.log('[gRPC] Verification failed: No token provided.');
        return callback(null, { error: 'Token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Decoded payload should contain: id, user_id, name, profile_pic_filename
        console.log(`[gRPC] Token verified successfully for user: ${decoded.name} (ID: ${decoded.id})`);
        const userInfo = {
            id: decoded.id, // MongoDB _id as string
            user_login_id: decoded.user_id,
            name: decoded.name,
            profile_pic_filename: decoded.profile_pic_filename || null
        };
        callback(null, { user_info: userInfo });
    } catch (err) {
        console.log(`[gRPC] Token verification failed: ${err.message}`);
        callback(null, { error: `Invalid or expired token: ${err.message}` });
    }
};

// Create and Start gRPC Server
const grpcServer = new grpc.Server();
grpcServer.addService(authProto.AuthService.service, { verifyToken: verifyToken });

grpcServer.bindAsync(`0.0.0.0:${grpcPort}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
        console.error('Failed to bind gRPC server:', err);
        process.exit(1);
    }
    console.log(`AuthApp gRPC Server running at grpc://localhost:${port}`);
});