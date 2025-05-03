import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import userRoutes from './routes/users.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5001;

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

app.get('/', (_req, res) => res.send('AuthApp Backend Running'));

app.listen(port, () => {
    console.log(`AuthApp Server listening at http://localhost:${port}`);
});