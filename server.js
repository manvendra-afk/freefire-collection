const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

// Verify environment variables are loaded
console.log("Cloudinary Config Check:");
console.log("- Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME ? "Loaded OK" : "MISSING!");
console.log("- API Key:", process.env.CLOUDINARY_API_KEY ? "Loaded OK" : "MISSING!");
console.log("- API Secret:", process.env.CLOUDINARY_API_SECRET ? "Loaded OK" : "MISSING!");

// Configure Cloudinary using environment variables from Render
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer Storage for Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        return {
            folder: 'freefire_collections',
            resource_type: 'auto'
        };
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit per file
});

// Database Connection (MongoDB Atlas)
mongoose.connect('mongodb+srv://daujibasti1451_db_user:qfLnMKL34uS3UXfN@cluster0.5eysgyh.mongodb.net/freefire_collection?appName=Cluster0')
  .then(() => console.log('Connected to MongoDB Atlas successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

// Database Schemas & Models
const UserSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true, match: /^\d+$/ },
    password: { type: String, required: true }
});

const MediaSchema = new mongoose.Schema({
    uid: { type: String, required: true, index: true },
    filename: String,
    fileUrl: String,
    fileType: String,
    uploadedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Media = mongoose.model('Media', MediaSchema);

// --- API ROUTES ---

app.post('/api/register', async (req, res) => {
    try {
        const { uid, password } = req.body;
        if (!/^\d+$/.test(uid)) {
            return res.status(400).json({ error: "UID must contain numbers only." });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ uid, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: "Account created successfully!" });
    } catch (err) {
        res.status(400).json({ error: "UID already exists or invalid data." });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { uid, password } = req.body;
        const user = await User.findOne({ uid });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Invalid UID or password." });
        }
        res.json({ message: "Login successful", uid: user.uid });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/upload', (req, res) => {
    upload.array('mediaFiles', 50)(req, res, async function (err) {
        if (err) {
            console.error("Multer/Cloudinary Upload Error:", err);
            return res.status(500).json({ error: "Upload Middleware Error: " + err.message });
        }
        try {
            const { uid } = req.body;
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: "No files uploaded." });
            }

            const mediaDocs = req.files.map(file => ({
                uid,
                filename: file.originalname,
                fileUrl: file.path,
                fileType: file.mimetype.startsWith('video') ? 'video' : 'image'
            }));

            await Media.insertMany(mediaDocs);
            res.json({ message: "Files uploaded successfully!" });
        } catch (dbErr) {
            console.error("Database Insert Error:", dbErr);
            res.status(500).json({ error: "Database Error: " + dbErr.message });
        }
    });
});

app.get('/api/collection/:uid', async (req, res) => {
    try {
        const { uid } = req.params;
        const mediaItems = await Media.find({ uid }).sort({ uploadedAt: -1 });
        if (mediaItems.length === 0) {
            return res.status(404).json({ error: "No profile or collection found for this UID." });
        }
        res.json({ uid, items: mediaItems });
    } catch (err) {
        res.status(500).json({ error: "Search failed." });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});