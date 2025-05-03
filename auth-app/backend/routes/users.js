// backend/routes/users.js
import express from 'express';
import bcrypt from 'bcrypt';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken'; // <-- Import jwt
import User from '../models/User.js'; // Ensure path to model is correct

const router = express.Router();

// --- Disk Storage Configuration ---
const uploadDir = path.resolve('uploads/profile_pics');
// Ensure the directory exists
try {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`Upload directory ensured at: ${uploadDir}`);
} catch (err) {
    console.error(`Error creating upload directory: ${uploadDir}`, err);
    // Depending on severity, you might want to exit or handle differently
}


const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir); // Use the absolute path
    },
    filename: (_req, file, cb) => {
        crypto.randomBytes(16, (err, buf) => {
            if (err) {
                console.error("Error generating crypto bytes for filename", err);
                return cb(err);
            }
            const ext = path.extname(file.originalname);
            // Sanitize extension if needed, though path.extname usually handles it well
            const name = buf.toString('hex') + ext;
            cb(null, name);
        });
    }
});

// --- Multer Middleware ---
// Add file filter for basic security (optional but recommended)
const fileFilter = (_req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif') {
        cb(null, true); // Accept file
    } else {
        cb(new Error('Invalid file type, only JPEG, PNG, or GIF allowed!'), false); // Reject file
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // Optional: Limit file size (e.g., 5MB)
    fileFilter: fileFilter
});


// --- Cleanup Function ---
const deleteUploadedFileOnError = (file) => {
    if (file && file.path) { // Check if file and path exist
        fs.unlink(file.path, (err) => {
            if (err) {
                console.error(`Error deleting uploaded file ${file.path} after error:`, err);
            } else {
                // console.log(`Cleaned up uploaded file: ${file.path}`);
            }
        });
    }
}

// ─── Signup ────────────────────────────────────────────────────────────────
// Apply multer middleware here. Handle potential multer errors too.
router.post('/signup', (req, res) => {
    // Call multer middleware manually to handle errors gracefully
    upload.single('profilePic')(req, res, async (err) => {
        // Handle Multer specific errors (like file size limit, file type)
        if (err instanceof multer.MulterError) {
            console.error("Multer Error:", err);
            return res.status(400).json({ message: `File upload error: ${err.message}` });
        } else if (err) {
            // Handle other errors (like invalid file type from our filter)
            console.error("File Filter/Other Upload Error:", err);
            return res.status(400).json({ message: err.message || 'Invalid file provided.' });
        }

        // If we reach here, file upload (if a file was provided) was successful or no file was provided.
        const { user_id, raw_password, name, country, email } = req.body;
        const file = req.file; // Contains file info if uploaded

        // Basic validation
        if (!user_id || !raw_password || !name || !country || !email) {
            // Delete uploaded file if present because request is invalid
            deleteUploadedFileOnError(file);
            return res.status(400).json({ message: 'All fields except picture are required' });
        }

        try {
            const exists = await User.findOne({ $or: [{ user_id }, { email }] });
            if (exists) {
                deleteUploadedFileOnError(file); // Delete file if user exists
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
                profile_pic_filename: file ? file.filename : null // Store filename if file exists
            });

            const saved = await newUser.save();
            // Prepare response object (don't send back password hash)
            const userObj = saved.toObject(); // Convert Mongoose doc to plain object
            delete userObj.password_hash; // Remove sensitive data

            res.status(201).json({ message: 'User created successfully', user: userObj });
        } catch (dbErr) {
            console.error('Signup DB/Save Error:', dbErr);
            // Cleanup uploaded file on database error
            deleteUploadedFileOnError(file);

            // Check for MongoDB duplicate key error (code 11000)
             if (dbErr.code === 11000) {
                 // Determine which field caused the duplication
                 const field = Object.keys(dbErr.keyValue)[0];
                 const message = `${field === 'user_id' ? 'User ID' : 'Email'} already exists.`;
                 return res.status(409).json({ message }); // 409 Conflict
             }

            // Handle Mongoose validation errors
             if (dbErr.name === 'ValidationError') {
                const messages = Object.values(dbErr.errors).map(val => val.message);
                return res.status(400).json({ message: messages.join(', ') });
             }

             // Generic server error for other cases
            res.status(500).json({ message: 'Server error during signup' });
        }
    }); // End of upload.single() wrapper
});


// ─── Login ─────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { user_id, password } = req.body;
    if (!user_id || !password) {
        return res.status(400).json({ message: 'User ID and password are required' });
    }

    try {
        // Find user by user_id
        const user = await User.findOne({ user_id });

        if (!user) {
            console.log(`Login attempt failed: User not found for ID ${user_id}`);
            return res.status(401).json({ message: 'Invalid credentials' }); // Generic message
        }

        // Compare provided password with the stored hash
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            console.log(`Login attempt failed: Invalid password for User ID ${user_id}`);
            return res.status(401).json({ message: 'Invalid credentials' }); // Generic message
        }

        // --- Update last_login ---
        user.last_login = new Date();
        await user.save(); // Save the updated last_login time

        // --- JWT GENERATION ---
        // Create payload for JWT. Include data needed by frontend or chat service.
        // Crucially includes MongoDB '_id' which uniquely identifies the user internally.
        const payload = {
            id: user._id.toString(), // MongoDB Object ID as string (Primary Key)
            user_id: user.user_id,   // User-provided ID string
            name: user.name,
            profile_pic_filename: user.profile_pic_filename // Include profile pic ID if needed directly by chat
            // Add any other non-sensitive info you might need client-side
        };

        // Sign the token
        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET, // Use the secret from .env
            { expiresIn: '1h' } // Set expiration time (e.g., 1 hour, '1d' for day, '7d' for week)
        );
        // --- END JWT GENERATION ---


        // --- Prepare user object for response (without sensitive data like password hash) ---
        const userResponse = {
            _id: user._id.toString(),
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            country: user.country,
            created_at: user.created_at,
            last_login: user.last_login,
            profile_pic_id: user.profile_pic_filename // Consistent key for frontend
        };

        console.log(`Login successful for User ID: ${user_id}`);

        // --- RETURN TOKEN and User Info ---
        res.status(200).json({
            message: 'Login successful',
            user: userResponse, // User details for the frontend app state
            token: token        // Token for authenticating subsequent requests (like WebSocket)
        });

    } catch (err) {
        console.error('Login Server Error:', err);
        res.status(500).json({ message: 'Server error during login' });
    }
});

export default router;