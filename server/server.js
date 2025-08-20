import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { connectDB } from "./lib/db.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import { Server } from "socket.io";
import path from "path";

// Create express app and HTTP server
const app = express();
const server = http.createServer(app);
const __dirname = path.resolve();

// Initialize socket.io server
export const io = new Server(server, {
  cors: { origin: "*" },
});

// ✅ Store online users: userId => Set of socket IDs
export const userSocketMap = {}; // { userId: Set(socketIds) }

// Helper to get sockets by userId
export const getUserSocket = (userId) => {
  return userSocketMap[userId];
};

// Socket.io connection handler (single clean version)
io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  console.log("🟢 User Connected:", userId, "Socket ID:", socket.id);

  if (userId) {
    if (!userSocketMap[userId]) {
      userSocketMap[userId] = new Set();
    }
    userSocketMap[userId].add(socket.id);

    // Notify all users of updated online users
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  }

  socket.on("disconnect", () => {
    console.log("🔴 User Disconnected:", socket.id, "for user:", userId);

    if (userId && userSocketMap[userId]) {
      userSocketMap[userId].delete(socket.id);
      if (userSocketMap[userId].size === 0) {
        delete userSocketMap[userId];
      }
    }

    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

// Connect to MongoDB
await connectDB();

// Middleware
app.use(express.json({ limit: "4mb" }));
app.use(cors());

// Routes
app.use("/api/status", (req, res) => res.send("Server is Live ✅"));
app.use("/api/auth", userRouter);
app.use("/api/messages", messageRouter);

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"));
  });
} else {
  // Local development
  const PORT = process.env.PORT || 5001;
  server.listen(PORT, () =>
    console.log("🚀 Server is listening at PORT:", PORT)
  );
}

// ✅ For Vercel: export app, not server
export default app;
