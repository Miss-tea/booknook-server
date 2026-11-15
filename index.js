import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import express from "express";
import cors from "cors";
import "dotenv/config";
import jwt from "jsonwebtoken";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [process.env.CLIENT_URL, "http://localhost:3000"].filter(Boolean),
    credentials: true,
  })
);
app.use(express.json());

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

  try {
    await borrowsCollection.createIndex(
      { userEmail: 1, bookId: 1 },
      { unique: true }
    );
  } catch (err) {
    console.warn("⚠️ Could not create borrow index:", err.message);
  }

  console.log("✅ MongoDB connected");
}

function verifyJWT(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Please log in to continue." });
  }

  const token = header.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] }, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ message: "Your session has expired. Please log in again." });
    }
    req.user = decoded;
    next();
  });
}

app.get("/", (req, res) => {
  res.send({ message: "BookNook server is running 📚" });
});

app.get("/books", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 0;
    const query = req.query.email ? { userEmail: req.query.email } : {};

    const books = await booksCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    res.send(books);
  } catch (error) {
    res.status(500).send({ message: "Could not load books. Please try again." });
  }
});

app.get("/books/:id", verifyJWT, async (req, res) => {
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

app.post("/books", verifyJWT, async (req, res) => {
  try {
    const { title, author, category, image, description, totalCopies } = req.body;

    const allowedCategories = ["Fiction", "Science", "History", "Kids", "Others"];
    const copies = Number(totalCopies);

    if (!title || !author || !image || !description) {
      return res.status(400).send({ message: "Please fill in all the fields." });
    }
    if (!allowedCategories.includes(category)) {
      return res.status(400).send({ message: "Please choose a valid category." });
    }
    if (!Number.isInteger(copies) || copies < 1) {
      return res
        .status(400)
        .send({ message: "Total copies must be a whole number of 1 or more." });
    }

    const newBook = {
      title: title.trim(),
      author: author.trim(),
      category,
      image,
      description: description.trim(),
      totalCopies: copies,
      availableCopies: copies,
      userName: req.user.name,
      userEmail: req.user.email,
      createdAt: new Date(),
    };

    const result = await booksCollection.insertOne(newBook);
    res.status(201).send({ ...newBook, _id: result.insertedId });
  } catch (error) {
    res.status(500).send({ message: "Could not add the book. Please try again." });
  }
});

app.patch("/books/:id", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "This book id is not valid." });
    }

    const book = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!book) {
      return res.status(404).send({ message: "Book not found." });
    }
    if (book.userEmail !== req.user.email) {
      return res
        .status(403)
        .send({ message: "You can only edit your own books." });
    }

    const { title, author, category, image, description, totalCopies } = req.body;
    const allowedCategories = ["Fiction", "Science", "History", "Kids", "Others"];

    const updates = {};
    if (title) updates.title = title.trim();
    if (author) updates.author = author.trim();
    if (image) updates.image = image;
    if (description) updates.description = description.trim();
    if (category) {
      if (!allowedCategories.includes(category)) {
        return res.status(400).send({ message: "Please choose a valid category." });
      }
      updates.category = category;
    }

    let copiesChange = 0;
    if (totalCopies !== undefined) {
      const newTotal = Number(totalCopies);
      if (!Number.isInteger(newTotal) || newTotal < 1) {
        return res
          .status(400)
          .send({ message: "Total copies must be a whole number of 1 or more." });
      }
      copiesChange = newTotal - book.totalCopies;
      if (book.availableCopies + copiesChange < 0) {
        return res.status(400).send({
          message: "You cannot lower the total below the number of copies already borrowed.",
        });
      }
      updates.totalCopies = newTotal;
    }

    const updateDoc = { $set: updates };
    if (copiesChange !== 0) {
      updateDoc.$inc = { availableCopies: copiesChange };
    }

    await booksCollection.updateOne({ _id: new ObjectId(id) }, updateDoc);
    const updatedBook = await booksCollection.findOne({ _id: new ObjectId(id) });
    res.send(updatedBook);
  } catch (error) {
    res.status(500).send({ message: "Could not update the book. Please try again." });
  }
});

app.delete("/books/:id", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "This book id is not valid." });
    }

    const book = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!book) {
      return res.status(404).send({ message: "Book not found." });
    }
    if (book.userEmail !== req.user.email) {
      return res
        .status(403)
        .send({ message: "You can only delete your own books." });
    }

    await booksCollection.deleteOne({ _id: new ObjectId(id) });
    res.send({ message: "Book deleted successfully." });
  } catch (error) {
    res.status(500).send({ message: "Could not delete the book. Please try again." });
  }
});

app.post("/borrows", verifyJWT, async (req, res) => {
  try {
    const { bookId } = req.body;
    if (!bookId || !ObjectId.isValid(bookId)) {
      return res.status(400).send({ message: "This book id is not valid." });
    }

    const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });
    if (!book) {
      return res.status(404).send({ message: "Book not found." });
    }

    const alreadyBorrowed = await borrowsCollection.findOne({
      bookId: book._id.toString(),
      userEmail: req.user.email,
    });
    if (alreadyBorrowed) {
      return res.status(409).send({
        message: "You have already borrowed this book. Return it before borrowing again.",
      });
    }

    const taken = await booksCollection.findOneAndUpdate(
      { _id: book._id, availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } }
    );
    if (!taken) {
      return res
        .status(400)
        .send({ message: "Sorry, no copies of this book are available right now." });
    }

    const borrowDate = new Date();
    const returnDate = new Date(borrowDate);
    returnDate.setDate(returnDate.getDate() + 7);

    const borrow = {
      bookId: book._id.toString(),
      bookTitle: book.title,
      bookImage: book.image,
      userName: req.user.name,
      userEmail: req.user.email,
      borrowDate,
      returnDate,
    };

    try {
      const result = await borrowsCollection.insertOne(borrow);
      res.status(201).send({ ...borrow, _id: result.insertedId });
    } catch (insertError) {
      await booksCollection.updateOne(
        { _id: book._id },
        { $inc: { availableCopies: 1 } }
      );
      if (insertError.code === 11000) {
        return res.status(409).send({
          message: "You have already borrowed this book. Return it before borrowing again.",
        });
      }
      throw insertError;
    }
  } catch (error) {
    res.status(500).send({ message: "Could not borrow the book. Please try again." });
  }
});

app.get("/borrows", verifyJWT, async (req, res) => {
  try {
    const borrows = await borrowsCollection
      .find({ userEmail: req.user.email })
      .sort({ borrowDate: -1 })
      .toArray();

    res.send(borrows);
  } catch (error) {
    res.status(500).send({ message: "Could not load your borrowed books." });
  }
});

app.delete("/borrows/:id", verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "This borrow id is not valid." });
    }

    const borrow = await borrowsCollection.findOne({ _id: new ObjectId(id) });
    if (!borrow) {
      return res.status(404).send({ message: "Borrow record not found." });
    }
    if (borrow.userEmail !== req.user.email) {
      return res
        .status(403)
        .send({ message: "You can only return books that you borrowed." });
    }

    await borrowsCollection.deleteOne({ _id: new ObjectId(id) });

    if (ObjectId.isValid(borrow.bookId)) {
      await booksCollection.updateOne(
        {
          _id: new ObjectId(borrow.bookId),
          $expr: { $lt: ["$availableCopies", "$totalCopies"] },
        },
        { $inc: { availableCopies: 1 } }
      );
    }

    res.send({ message: "Book returned successfully." });
  } catch (error) {
    res.status(500).send({ message: "Could not return the book. Please try again." });
  }
});

connectDB()
  .then(() => {
    app.listen(port, () => console.log(`🚀 Server on port ${port}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
  });