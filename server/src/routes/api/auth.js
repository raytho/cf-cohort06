const express = require("express");
const passport = require("passport");
const boom = require("@hapi/boom");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const config = require("../../config");
const UsersService = require("../../services/usersService");
const PermissesService = require("../../services/permissesService");
const validationHandler = require("../../utils/middleware/validationHandler");

const { createUserSchema } = require("../../utils/schemas/users");

// Basic Strategy
require("../../utils/auth/strategies/basic");
require("../../utils/auth/strategies/jwt");
require("../../utils/auth/strategies/jwtTwoFactor");
require("../../utils/auth/strategies/jwtLogout");
const twoFactorAuth = require("../../utils/auth/strategies/twoFactorAuth");

function authApi(app) {
  const router = express.Router();
  app.use("/api/auth", router);

  const usersService = new UsersService();

  router.post("/sign-in", async (req, res, next) => {
    passport.authenticate("basic", async (error, user) => {
      try {
        if (error || !user) {
          res.status(500).json({
            message: "No autorizado",
          });
        } else {
          if (user.twoFactorActive) {
            generateTempToken(req, res, next, user);
          } else {
            generateToken(req, res, next, user);
          }
        }
      } catch (error) {
        next(error);
      }
    })(req, res, next);
  });

  router.post(
    "/sign-up",
    validationHandler(createUserSchema),
    async (req, res, next) => {
      const { body: user } = req;
      try {
        const hasInvited = await usersService.getInviteInfo(user);
        const existingUser = await usersService.getUserByMail(user);
        if (existingUser) {
          res.status(200).json({
            message:
              "Este correo ya está en uso, por favor intente con otro o reestableza su contraseña",
          });
        } else {
          if (hasInvited) {
            await usersService.createSuperAdminUser({ user }, hasInvited);
            await usersService.updateInvitationByUserInvited(hasInvited);
            res.status(201).json({
              message: "User created",
            });
          } else {
            res.status(500).json({
              message:
                "No se puede registrar un usuario sin invitacion, favor de validar",
            });
          }
        }
      } catch (error) {
        next(error);
      }
    }
  );

  router.post("/two-factor", async (req, res, next) => {
    passport.authenticate("jwtTwoFactor", { session: false }, (error, user) => {
      try {
        if (error || !user) {
          res.status(500).json({
            message: "Invalid Token",
          });
        } else {
          const secret = config.twoFactorSecret;
          const { token } = req.body;
          const authorizedUser = twoFactorAuth.verify(secret, token);
          if (authorizedUser) {
            generateToken(req, res, next, user);
          } else {
            res.status(500).json({
              message: "Invalid code",
            });
          }
        }
      } catch (error) {
        next(error);
      }
    })(req, res, next);
  });

  router.post("/send-mail-code", async (req, res, next) => {
    passport.authenticate("jwtTwoFactor", { session: false }, (error, user) => {
      try {
        if (error || !user) {
          next(boom.unauthorized());
        } else {
          const secret = config.twoFactorSecret;
          const token = twoFactorAuth.generateTotpToken(secret);
          usersService.sendTokenToMail(user.email, token);
          return res.status(200).json({
            error: null,
            message: "Código enviado al correo",
          });
        }
      } catch (error) {
        next(error);
      }
    })(req, res, next);
  });

  router.post("/two-factor-mail", async (req, res, next) => {
    passport.authenticate("jwtTwoFactor", { session: false }, (error, user) => {
      try {
        if (error || !user) {
          res.status(500).json({
            message: "Invalid Token",
          });
        } else {
          const { token } = req.body;
          const secret = config.twoFactorSecret;
          const authorizedUser = twoFactorAuth.verifyMailToken(secret, token);
          if (authorizedUser) {
            generateToken(req, res, next, user);
          } else {
            res.status(500).json({
              message: "Invalid code",
            });
          }
        }
      } catch (error) {
        next(error);
      }
    })(req, res, next);
  });

  router.post("/two-factor-activate", async (req, res, next) => {
    passport.authenticate("jwt", { session: false }, async (error, user) => {
      const { twoFactorActive } = req.body;
      if (error || !user) {
        next(boom.unauthorized());
      } else {
        try {
          if (
            !(
              twoFactorActive === null ||
              twoFactorActive === "" ||
              twoFactorActive === undefined
            )
          ) {
            const active = await usersService.activeTwoFactorUserByID(
              twoFactorActive,
              user
            );

            if (active) {
              res.status(200).json({
                data: { message: "2FA value has change" },
                error: null,
              });
            } else {
              res.status(500).json({
                message: "No autorizado",
              });
            }
          } else {
            res.status(200).json({ data: null, error: "Needed value" });
          }
        } catch (error) {
          next(error);
        }
      }
    })(req, res, next);
  });

  router.post("/two-factor-activate-users", async (req, res, next) => {
    passport.authenticate("jwt", { session: false }, async (error, user) => {
      const { twoFactorActive } = req.body;
      if (error || !user) {
        next(boom.unauthorized());
      } else {
        try {
          if (
            !(
              twoFactorActive === null ||
              twoFactorActive === "" ||
              twoFactorActive === undefined
            )
          ) {
            const active = await usersService.activeTwoFactorAllUsersByCreated(
              twoFactorActive,
              user
            );

            if (active) {
              res.status(200).json({
                data: { message: "2FA value has change" },
                error: null,
              });
            } else {
              res.status(500).json({
                message: "No autorizado",
              });
            }
          } else {
            res.status(200).json({ data: null, error: "Needed value" });
          }
        } catch (error) {
          next(error);
        }
      }
    })(req, res, next);
  });

  router.post("/forgot", async (req, res, next) => {
    const email = req.body.email;
    if (email) {
      const user = await usersService.getUserByMail({ email });

      if (!user) {
        res.status(404).json({
          error: "No account with that email address exists.",
          data: null,
        });
      } else {
        const token = crypto.randomBytes(20).toString("hex");
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 900000;

        const account = {
          email: user.email,
          token: user.resetPasswordToken,
          expires: user.resetPasswordExpires,
          dateRegister: new Date().toLocaleString(),
          host: req.headers.host,
        };

        const reset = usersService.sendResetLink(account);
        delete account.host;
        const accoutSetting = await usersService.createAccoutSetting(account);
        if (reset && accoutSetting) {
          res.status(201).json({
            message: "Link sent",
          });
        }
      }
    } else {
      next(boom.unauthorized());
    }
  });

  router.get("/newpassword/:token", async (req, res, next) => {
    const { token } = req.params;
    if (!token) {
      next(boom.unauthorized());
    } else {
      const minutes = 1000 * 60;
      const validateUser = await usersService.getUserBytoken(token);
      const fechaToken = validateUser.expires / minutes;
      const diferencia = Math.round(fechaToken - Date.now() / minutes);

      if (diferencia <= 0) {
        res.status(200).json({
          data: null,
          error: "Expired token",
        });
      } else {
        if (!validateUser) {
          res.status(500).json({
            data: null,
            error: "Internal error",
          });
        } else {
          delete validateUser.id;
          delete validateUser.token;
          delete validateUser.expires;
          delete validateUser.dateRegister;

          res.status(200).json({
            data: validateUser,
            error: null,
          });
        }
      }
    }
  });

  router.put("/password", async (req, res, next) => {
    passport.authenticate(
      "jwt",
      { session: false },
      async (error, userToken) => {
        if (!userToken || !req.body) {
          res.status(400).json({
            message: "Bad request",
            error: "Bad request",
          });
        } else {
          const newPassword = req.body.password;
          if (!newPassword) {
            res.status(400).json({
              message: "Bad request",
              error: "Bad request",
            });
          } else {
            try {
              const updatedUser = await usersService.updatePasswordUserByID(
                userToken.email,
                newPassword
              );
              if (updatedUser) {
                res.status(200).send({
                  data: updatedUser.message,
                  message: "User updated",
                });
              }
            } catch (error) {
              console.log(error);
              res.status(500).json({ message: "Error to get user" });
            }
          }
        }
      }
    )(req, res, next);
  });

  router.get("/logout", function (req, res, next) {
    passport.authenticate("jwt", { session: false }, () => {
      req.logOut();
      return res.redirect("/");
    })(req, res, next);
  });
}

const generateToken = (req, res, next, user) => {
  req.login(user, { session: false }, async (error) => {
    if (error) {
      next(error);
    } else {
      const usersService = new UsersService();
      const permissesService = new PermissesService();
      const permissions = await permissesService.getPermissesByRol(user);
      const isConfigured = await usersService.checkInitialConfig(
        user.idCountry
      );
      const fiscalData = await usersService.getFiscalData(user.fiscalId);
      const country = await usersService.getCountry(user.idCountry);

      const {
        userId,
        email,
        city,
        state,
        dateOfBirth,
        fiscalAct,
        firstName,
        lastName,
        phoneNumber,
        twoFactorActive,
        role,
        profile_picture_url,
      } = user;
      const twoFactorToNumber = twoFactorActive == 1 ? true : false;
      const payload = {
        sub: userId,
        email,
        role,
      };
      const token = jwt.sign(payload, config.authJwtSecret, {
        expiresIn: "24h",
      });

      const formatDate = formatUTCTime(dateOfBirth);
      return res.status(200).json({
        token,
        user: {
          userId,
          email,
          country: country,
          city,
          state,
          dateOfBirth: formatDate,
          fiscalAct,
          firstName,
          lastName,
          phoneNumber,
          twoFactorActive: twoFactorToNumber,
          role,
          profile_picture_url,
          hasConfigured: isConfigured ? true : false,
          ...fiscalData,
          fiscalIdentifierName: isConfigured,
          permissions,
        },
      });
    }
  });
};

const generateTempToken = (req, res, next, user) => {
  req.login(user, { session: false }, async (error) => {
    if (error) {
      next(error);
    } else {
      const { userId, email, twoFactorActive } = user;
      const twoFactorToNumber = twoFactorActive == 1 ? true : false;
      const payload = {
        sub: userId,
        email,
      };
      const token = jwt.sign(payload, config.authTwoFactorJwtSecret, {
        expiresIn: "12m",
      });
      return res.status(200).json({
        token,
        user: { userId, email, twoFactorActive: twoFactorToNumber },
      });
    }
  });
};

const formatUTCTime = (date) => {
  const day = date.getUTCDate(); // Hours
  let month = date.getUTCMonth() + 1;
  month = month < 10 ? `0${month}` : month;
  const years = date.getUTCFullYear();
  const newDate = `${years}-${month}-${day}`;
  return newDate;
};

module.exports = authApi;
