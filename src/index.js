/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
// Modules
const express = require("express");
const helmet = require("helmet");
const notFoundHandler = require("./utils/middleware/notFoundHandler");
const authApiRouter = require("./routes/api/auth");
const rolesApiRouter = require("./routes/api/roles");
const home = require("./routes/views/home"); 
const userViewRouter = require("./routes/views/user");
const superAdminRouter = require("./routes/views/superAdmin");
require("dotenv").config();
const cors = require("cors");

// App
const app = express();

// Config Port
const _port = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(helmet());
app.user(cosr());


// Routes
app.use("/", home);
authApiRouter(app);
// userViewRouter(app);
rolesApiRouter(app);
superAdminRouter(app);

// 404 handler
app.use(notFoundHandler);

// Init Server
const server = app.listen(_port, () => {
  console.log(`Server running on port: ${_port}`);
});