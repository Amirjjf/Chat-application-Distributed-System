import express from 'express';
import bcrypt from 'bcrypt';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

const uploadDir = path.resolve('uploads/profile_pics');
try {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`Upload directory ensured at: ${uploadDir}`);
} catch (err) {
    console.error(`Error creating upload directory: ${uploadDir}`, err);
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        crypto.randomBytes(16, (err, buf) => {
            if (err) {
                console.error("Error generating crypto bytes for filename", err);
                return cb(err);
            }
            const ext = path.extname(file.originalname);
            const name = buf.toString('hex') + ext;
            cb(null, name);
        });
    }
});

const fileFilter = (_req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif') {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type, only JPEG, PNG, or GIF allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 },
    fileFilter: fileFilter
});

const deleteUploadedFileOnError = (file) => {
    if (file && file.path) {
        fs.unlink(file.path, (err) => {
            if (err) {
                console.error(`Error deleting uploaded file ${file.path} after error:`, err);
            }
        });
    }
}

router.post('/signup', (req, res) => {
    upload.single('profilePic')(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            console.error("Multer Error:", err);
            return res.status(400).json({ message: `File upload error: ${err.message}` });
        } else if (err) {
            console.error("File Filter/Other Upload Error:", err);
            return res.status(400).json({ message: err.message || 'Invalid file provided.' });
        }

        const { user_id, raw_password, name, country, email } = req.body;
        const file = req.file;

        if (!user_id || !raw_password || !name || !country || !email) {
            deleteUploadedFileOnError(file);
            return res.status(400).json({ message: 'All fields except picture are required' });
        }

        try {
            const exists = await User.findOne({ $or: [{ user_id }, { email }] });
            if (exists) {
                deleteUploadedFileOnError(file);
                return res.status(409).json({ message: 'User ID or Email already exists' });
            }

            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(raw_password, salt);

            const newUser = new User({
                user_id,
                password_hash,
                name,
                email,
                country,
                profile_pic_filename: file ? file.filename : null
            });

            const saved = await newUser.save();
            const userObj = saved.toObject();
            delete userObj.password_hash;

            res.status(201).json({ message: 'User created successfully', user: userObj });
        } catch (dbErr) {
            console.error('Signup DB/Save Error:', dbErr);
            deleteUploadedFileOnError(file);

            if (dbErr.code === 11000) {
                const field = Object.keys(dbErr.keyValue)[0];
                const message = `${field === 'user_id' ? 'User ID' : 'Email'} already exists.`;
                return res.status(409).json({ message });
            }

            if (dbErr.name === 'ValidationError') {
                const messages = Object.values(dbErr.errors).map(val => val.message);
                return res.status(400).json({ message: messages.join(', ') });
            }

            res.status(500).json({ message: 'Server error during signup' });
        }
    });
});

router.post('/login', async (req, res) => {
    const { user_id, password } = req.body;
    if (!user_id || !password) {
        return res.status(400).json({ message: 'User ID and password are required' });
    }

    try {
        const user = await User.findOne({ user_id });

        if (!user) {
            console.log(`Login attempt failed: User not found for ID ${user_id}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            console.log(`Login attempt failed: Invalid password for User ID ${user_id}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        user.last_login = new Date();
        await user.save();

        const payload = {
            id: user._id.toString(),
            user_id: user.user_id,
            name: user.name,
            profile_pic_filename: user.profile_pic_filename
        };

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        const userResponse = {
            _id: user._id.toString(),
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            country: user.country,
            created_at: user.created_at,
            last_login: user.last_login,
            profile_pic_id: user.profile_pic_filename
        };

        console.log(`Login successful for User ID: ${user_id}`);

        res.status(200).json({
            message: 'Login successful',
            user: userResponse,
            token: token
        });

    } catch (err) {
        console.error('Login Server Error:', err);
        res.status(500).json({ message: 'Server error during login' });
    }
});

export default router;