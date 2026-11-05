import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ServerApiVersion ,ObjectId } from "mongodb";

const app = express();
const port = process.env.PORT || 5000;

// Middleware 
app.use(
  cors({
    origin: [process.env.CLIENT_URL, "http://localhost:3000"],
    credentials: true,
  })
);
app.use(express.json());

// MongoDB
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

// for test
app.get("/", (req, res) => {
  res.send({ message: "BookNook server is running" });
});
// book routes
app.get("/books", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 0;
    const query = req.query.email ? { userEmail: req.query.email } : {};

    const books = await booksCollection
      .find(query)
      .sort({ createdAt: -1 }) // newest first
      .limit(limit)
      .toArray();

    res.send(books);
  } catch (error) {
    res.status(500).send({ message: "Could not load books. Please try again." });
  }
});

app.get("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "This book id is not valid." });
    }

    const book = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!book) {
      return res.status(404).send({ message: "Book not found." });
    }

    res.send(book);
  } catch (error) {
    res.status(500).send({ message: "Could not load this book." });
  }
});
//started
connectDB()
  .then(() => {
    app.listen(port, () => console.log(`Server on port ${port}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
  });