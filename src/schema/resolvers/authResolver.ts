import { GraphQLError } from "graphql";
import { User } from "../../models/User";
import { JWTUtils } from "../../utils/jwt";
import { requireAuth } from "../../middleware/auth";
import { GraphQLContext, LoginInput, RegisterInput } from "../../types";

export const authResolvers = {
  Query: {
    me: async (_: any, __: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      return user;
    },
  },

  Mutation: {
    register: async (_: any, { input }: { input: RegisterInput }) => {
      try {
        const existingUser = await User.findOne({
          $or: [{ email: input.email }, { username: input.username }],
        });

        if (existingUser) {
          throw new GraphQLError(
            "User already exists with this email or username",
            {
              extensions: {
                code: "USER_ALREADY_EXISTS",
                field:
                  existingUser.email === input.email ? "email" : "username",
              },
            }
          );
        }

        const user = new User({
          username: input.username,
          email: input.email,
          password: input.password,
        });

        await user.save();

        const tokens = JWTUtils.generateTokens(user);

        user.refreshToken = tokens.refreshToken;
        await user.save();

        return {
          user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: 15 * 60,
        };
      } catch (error: any) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        if (error.name === "ValidationError") {
          const field = Object.keys(error.errors)[0] || "";
          const message = error.errors[field]?.message;
          throw new GraphQLError(message, {
            extensions: {
              code: "VALIDATION_ERROR",
              field,
            },
          });
        }

        throw new GraphQLError("Registration failed", {
          extensions: {
            code: "REGISTRATION_FAILED",
          },
        });
      }
    },

    login: async (_: any, { input }: { input: LoginInput }) => {
      try {
        const user = await User.findOne({ email: input.email }).select(
          "+password"
        );

        if (!user) {
          throw new GraphQLError("Invalid email or password", {
            extensions: {
              code: "INVALID_CREDENTIALS",
            },
          });
        }

        const isValidPassword = await user.comparePassword(input.password);
        if (!isValidPassword) {
          throw new GraphQLError("Invalid email or password", {
            extensions: {
              code: "INVALID_CREDENTIALS",
            },
          });
        }

        const tokens = JWTUtils.generateTokens(user);
        user.refreshToken = tokens.refreshToken;
        await user.save();

        return {
          user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: 15 * 60,
        };
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        throw new GraphQLError("Login failed", {
          extensions: {
            code: "LOGIN_FAILED",
          },
        });
      }
    },

    refreshToken: async (
      _: any,
      { refreshToken }: { refreshToken: string }
    ) => {
      try {
        const payload = JWTUtils.verifyRefreshToken(refreshToken);
        if (!payload) {
          throw new GraphQLError("Invalid refresh token", {
            extensions: {
              code: "INVALID_REFRESH_TOKEN",
            },
          });
        }

        const user = await User.findById(payload.userId).select(
          "+refreshToken"
        );
        if (!user || user.refreshToken !== refreshToken) {
          throw new GraphQLError("Invalid refresh token", {
            extensions: {
              code: "INVALID_REFRESH_TOKEN",
            },
          });
        }

        const newAccessToken = JWTUtils.generateAccessToken({
          userId: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        });

        return {
          accessToken: newAccessToken,
          expiresIn: 15 * 60,
        };
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        throw new GraphQLError("Token refresh failed", {
          extensions: {
            code: "TOKEN_REFRESH_FAILED",
          },
        });
      }
    },

    logout: async (_: any, __: any, context: GraphQLContext) => {
      try {
        const user = requireAuth(context);

        await User.findByIdAndUpdate(user._id, {
          $unset: { refreshToken: 1 },
        });

        return true;
      } catch (error) {
        throw new GraphQLError("Logout failed", {
          extensions: {
            code: "LOGOUT_FAILED",
          },
        });
      }
    },
  },
};
