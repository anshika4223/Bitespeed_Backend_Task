require("dotenv").config(); 

const express = require("express");
const app = express();

const identifyRoutes = require("./routes/identify");

const port = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.static("public"));

// View engine
app.set("view engine", "ejs");

// Routes
app.post("/identify", identifyRoutes);

app.get("/*", (req, res) => {
  res.render("home");
});

// Server
app.listen(port, () => {
  console.log(`Server started on port ${port}`);

});

