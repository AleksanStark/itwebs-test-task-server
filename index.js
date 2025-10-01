const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const app = express();
const http = require("http");
const multer = require("multer");
const { WebSocketServer } = require("ws");
const db = require("./db");
const server = http.createServer(app);
const port = 3001;
const wss = new WebSocketServer({ server });
require("dotenv").config();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

wss.broadcast = function broadcast(data) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
};

wss.on("connection", (ws) => {
  console.log("✅ Client connected to WebSocket");

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      if (data.type === "get_files") {
        const posts = db.prepare("SELECT * FROM files").all();
        ws.send(
          JSON.stringify({
            type: "all_files",
            payload: posts,
          })
        );
      }
    } catch (error) {
      console.error("❌ Error parsing message:", error);
    }
  });
});

wss.on("close", () => {
  console.log("❌ Client disconnected");
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, crypto.randomUUID() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log(`📂 Created directory: ${uploadsDir}`);
}

app.get("/posts", (req, res) => {
  try {
    const posts = db.prepare("SELECT * FROM files").all();
    if (!posts) {
      throw new Error("Posts not found");
    }
    res.status(200).json({ posts: posts });
  } catch (error) {
    res.status(400).json({ message: `${error}` });
  }
});

app.get("/download/:filename", (req, res) => {
  const { filename } = req.params;

  const filePath = path.join(__dirname, "uploads", filename);

  res.download(filePath, (err) => {
    if (err) {
      console.error("Error downloading file", err);
      if (!res.headersSent) {
        res.status(404).send("File not found");
      }
    }
  });
});

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file || !req.body.title) {
    return res.status(400).json({ message: "Title and file are required." });
  }

  const sqlQuery = db.prepare(`
     INSERT INTO files (title, filename, original_filename)
     VALUES (?, ?, ?)
    `);

  const result = sqlQuery.run(
    req.body.title,
    req.file.filename,
    req.file.originalname
  );

  const newFileMessage = {
    type: "new_file",
    payload: {
      id: result.lastInsertRowid,
      title: req.body.title,
      original_filename: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
    },
  };

  wss.broadcast(JSON.stringify(newFileMessage));
  console.log("📢 Broadcasted new file notification to all clients.");

  res.status(200).json({
    message: "File uploaded successfully!",
    fileInfo: newFileMessage.payload,
  });
});

server.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});
