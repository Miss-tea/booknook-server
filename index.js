import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ServerApiVersion } from "mongodb";

const app = express();
const port = process.env.PORT || 5000;

// ---------- Middleware ----------
app.use(
  cors({
    origin: [process.env.CLIENT_URL, "http://localhost:3000"],
    credentials: true,
  })
);
app.use(express.json());

// ---------- MongoDB ----------
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let booksCollection;
let borrowsCollection;

async function connectDB() {
  await client.connect();
  const db = client.db("booknook");
  booksCollection = db.collection("books");
  borrowsCollection = db.collection("borrows");
  console.log(" MongoDB connected");
}

// ---------- Test route ----------
app.get("/", (req, res) => {
  res.send({ message: "BookNook server is running" });
});

// ---------- Start ----------
connectDB()
  .then(() => {
    app.listen(port, () => console.log(`Server on port ${port}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
  });