import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

import userRoutes from './routes/users.js';
import User from './models/User.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5001;
const grpcPort = process.env.GRPC_PORT || 50051;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('AuthApp MongoDB Connected'))
    .catch(err => {
        console.error('AuthApp DB Connection Error:', err);
        process.exit(1);
    });

app.use('/api/users', userRoutes);
app.get('/', (_req, res) => res.send('AuthApp Backend (HTTP) Running'));

app.listen(port, () => {
    console.log(`AuthApp HTTP Server listening at http://localhost:${port}`);
});

const PROTO_PATH = path.join(__dirname, 'protos/auth.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const authProto = grpc.loadPackageDefinition(packageDefinition).auth;

const verifyToken = (call, callback) => {
    const token = call.request.token;
    console.log(`[gRPC] Received VerifyToken request`);

    if (!token) {
        console.log('[gRPC] Verification failed: No token provided.');
        return callback(null, { error: 'Token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log(`[gRPC] Token verified successfully for user: ${decoded.name} (ID: ${decoded.id})`);
        const userInfo = {
            id: decoded.id,
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

const grpcServer = new grpc.Server();
grpcServer.addService(authProto.AuthService.service, { verifyToken: verifyToken });

grpcServer.bindAsync(`0.0.0.0:${grpcPort}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
        console.error('Failed to bind gRPC server:', err);
        process.exit(1);
    }
    console.log(`AuthApp gRPC Server running at grpc://localhost:${port}`);
});