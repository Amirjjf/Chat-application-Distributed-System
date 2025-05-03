// backend/server.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url'; // Needed for __dirname in ES modules

import userRoutes from './routes/users.js';

dotenv.config(); // Load .env variables

// Calculate __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5001; // Use port from .env

// --- Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing for all origins
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies

// --- Static File Serving ---
// Serve the profile pictures from the 'uploads/profile_pics' directory
// The '/uploads/profile_pics' URL path will map to the actual directory
const uploadsPath = path.join(__dirname, 'uploads'); // Path relative to server.js
app.use('/uploads', express.static(uploadsPath));
console.log(`Serving static files from ${uploadsPath} at /uploads`);


// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('AuthApp MongoDB Connected'))
    .catch(err => {
        console.error('AuthApp DB Connection Error:', err);
        process.exit(1); // Exit process if DB connection fails
    });

// --- API Routes ---
// Mount the user-related routes (signup, login) under the /api/users path
app.use('/api/users', userRoutes);

// --- Basic Root Route ---
app.get('/', (_req, res) => res.send('AuthApp Backend Running'));

// --- Start Server ---
app.listen(port, () => {
    console.log(`AuthApp Server listening at http://localhost:${port}`);
});