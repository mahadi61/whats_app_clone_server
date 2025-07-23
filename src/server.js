const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

// =====================
// MongoDB Connection
// =====================
mongoose.connect('mongodb+srv://libraryDB:libraryDB@cluster0.2ev6cf0.mongodb.net/chat-app?retryWrites=true&w=majority&appName=Cluster0')
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// =====================
//  Mongoose Models
// =====================
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
 
},{
    versionKey: false
});

const User = mongoose.model('User', userSchema);

const messageSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
  },
  {
    timestamps: true, 
    versionKey: false,
  }
);

const Message = mongoose.model("Message", messageSchema);

// =====================
// Express + Socket Setup
// =====================
const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173','https://whats-app-clone-client-phi.vercel.app'], 
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// =====================
// API Routes
// =====================

// ➕ Save new user
app.post("/api/users", async (req, res) => {
  const { name, phone } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: "Name and phone are required" });
  }

  try {
    let user = await User.findOne({ phone });

    // Create user only if not exists
    if (!user) {
      user = new User({ name, phone });
      await user.save();
      res.json(user);
      console.log("Created new user:", user);
    } else {
      console.log("Existing user logged in:", user);
    }

    res.status(201).json(user);
  } catch (err) {
    console.error("User creation failed:", err);
    res.status(500).json({ error: "Failed to create or fetch user" });
  }
});



//Get  contacts
app.get("/api/contacts", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});


app.get("/api/users/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});


app.get("/api/messages/:from/:to", async (req, res) => {
  const { from, to } = req.params;

  try {
    const messages = await Message.find({
      $or: [
        { from, to },
        { from: to, to: from },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});



//  Root endpoint
app.get('/', (req, res) => {
  res.send("WhatsApp server is running");
});

// =====================
// 📡 Socket.io Events
// =====================
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`${userId} joined their room`);
  });

 
  socket.on("send-message", async ({ to, from, message }) => {
  // Emit to recipient
  io.to(to).emit("receive-message", message);
  console.log(`📤 Message from ${from} to ${to}: ${message}`);

  // Save to MongoDB
  try {
    const savedMessage = new Message({
      from,
      to,
      text: message,
    });
    await savedMessage.save();
    console.log("✅ Message saved:", savedMessage);
  } catch (err) {
    console.error("❌ Failed to save message:", err);
  }
});


  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// =====================
// 🚀 Start Server
// =====================
server.listen(3000, () => {
  console.log('✅ Server running at http://localhost:3000');
});
