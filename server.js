const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS) from the root directory
app.use(express.static(__dirname));

// Serve uploaded files publicly from the 'uploads' folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure File Uploads using Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${req.body.uid}-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });

// Database Connection (MongoDB Atlas with your updated password)
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
    fileType: String, // 'image' or 'video'
    uploadedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Media = mongoose.model('Media', MediaSchema);

// --- API ROUTES ---

// 1. User Registration (Ensuring UID is strictly numbers)
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

// 2. User Login
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

// 3. Upload Media (Images & Videos)
app.post('/api/upload', upload.array('mediaFiles', 10), async (req, res) => {
    try {
        const { uid } = req.body;
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No files uploaded." });
        }

        const mediaDocs = req.files.map(file => ({
            uid,
            filename: file.filename,
            fileUrl: `/uploads/${file.filename}`,
            fileType: file.mimetype.startsWith('video') ? 'video' : 'image'
        }));

        await Media.insertMany(mediaDocs);
        res.json({ message: "Files uploaded successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Upload failed." });
    }
});

// 4. Search and Fetch Collection by UID
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

// --- FRONTEND PAGE ROUTES ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(3000, () => {
    console.log('Server running on port http://localhost:3000');
});