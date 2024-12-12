const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;

const corsOption = {
  origin: ["http://localhost:5173", "https://mh-assignment-twelve.netlify.app"],
  Credentials: true,
  optionSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE"],
};

// middleware
app.use(cors(corsOption));
app.use(express.json());
app.use(cookieParser());

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log(token);
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wov5hm5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const usersCollection = client.db("houzez").collection("users");
    const propertyCollection = client.db("houzez").collection("properties");
    const bookingsCollection = client.db("houzez").collection("bookings");
    const wishlistCollection = client.db("houzez").collection("wishlists");
    const reviewCollection = client.db("houzez").collection("reviews");

    const verifyAdmin = async (req, res, next) => {
      const user = req.user;
      const query = { email: user?.email };
      const result = await usersCollection.findOne(query);
      console.log(result?.role);
      if (!result || result?.role !== "admin")
        return res.status(401).send({ message: "unauthorized access!!" });

      next();
    };
    // verify agent middleware
    const verifyAgent = async (req, res, next) => {
      console.log("hello");
      const user = req.user;
      const query = { email: user?.email };
      const result = await usersCollection.findOne(query);
      console.log(result?.role);
      if (!result || result?.role !== "agent") {
        return res.status(401).send({ message: "unauthorized access!!" });
      }

      next();
    };

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // save a user data in db
    app.put("/user", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        if (user.status === "Requested") {
          const result = await usersCollection.updateOne(query, {
            $set: { status: user?.status },
          });
          return res.send(result);
        } else {
          return res.send(isExist);
        }
      }
      // save user for the first time
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });
    // get a user info by email from db
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });
    // get all users data from db
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    //update a user role
    app.patch("/users/update/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email };
      const updateDoc = {
        $set: { ...user, timestamp: Date.now() },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    // Get all properties from db
    app.get("/properties", async (req, res) => {
      const category = req.query.category;
      let query = {};
      if (category && category !== "null") query = { category };
      const result = await propertyCollection.find(query).toArray();
      res.send(result);
    });

    // Save a property data in db
    app.post("/property", async (req, res) => {
      const propertyData = req.body;
      const result = await propertyCollection.insertOne(propertyData);
      res.send(result);
    });
    // delete a property
    app.delete("/property/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await propertyCollection.deleteOne(query);
      res.send(result);
    });

    // Get a single property data from db using _id
    app.get("/property/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await propertyCollection.findOne(query);
      res.send(result);
    });
    // update Property data
    app.put("/property/update/:id", async (req, res) => {
      const id = req.params.id;
      const propertyData = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: propertyData,
      };
      const result = await propertyCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // update Property Status
    app.patch("/property/status/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      // change property availability status
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { booked: status },
      };
      const result = await propertyCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    // Save a property to wishlist in db
    app.post("/wishlist", async (req, res) => {
      const wishlistData = req.body;
      const result = await wishlistCollection.insertOne(wishlistData);
      res.send(result);
    });
    // get all wishlist data from db
    app.get("/wishlist/:email", async (req, res) => {
      const email = req.params.users;
      const result = await wishlistCollection.find({ email }).toArray();
      res.send(result);
    });
    // Save a property review in db
    app.post("/review", async (req, res) => {
      const reviewData = req.body;
      const result = await reviewCollection.insertOne(reviewData);
      res.send(result);
    });
    // get all review data from db
    app.get("/review/:email", async (req, res) => {
      const email = req.params.users;
      const result = await reviewCollection.find({ email }).toArray();
      res.send(result);
    });
    // Get all rooms from db
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // get all Property for agent
    app.get("/my-listings/:email", async (req, res) => {
      const email = req.params.email;

      let query = { "agent.email": email };
      const result = await propertyCollection.find(query).toArray();
      res.send(result);
    });

    // get all booking for a guest
    app.get("/my-bookings/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "guest.email": email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    // get all booking for an Agent
    app.get("/manage-bookings/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "agent.email": email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    // delete a booking
    app.delete("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });

    // Clear token on logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (err) {
        res.status(500).send(err);
      }
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running");
});

app.listen(port, () => {
  console.log(`Assignment twelve is running on port ${port}`);
});
