// User and Password basic Authentication
const passport = require("passport");
const { BasicStrategy } = require("passport-http");
const boom = require("@hapi/boom");
const bcrypt = require("bcrypt");

const UsersService = require("../../../services/usersService");

passport.use(
  new BasicStrategy(async function (email, password, cb) {
    const usersService = new UsersService();
    try {
      const user = await usersService.getUserByMail({ email });
      if (!user) {
        return cb(boom.unauthorized(), false);
      }
      if (!(await bcrypt.compare(password, user.password))) {
        return cb(boom.unauthorized(), false);
      }
      delete user.password;
      return cb(null, user);
    } catch (error) {
      cb(error);
    }
  })
);
