import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/User";
import { UserInputError, AuthenticationError } from "apollo-server-express";
import { emailService } from "./emailService";
import { IUser } from "@/types";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: IUser;
  tokens: AuthTokens;
}

export interface RegisterInput {
  email: string;
  password: string;
  username: string;
  firstName: string;
  lastName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

class AuthService {
  // Generate JWT tokens
  generateTokens(userId: string, email: string): AuthTokens {
    const accessToken = jwt.sign({ userId, email }, process.env.JWT_SECRET!, {
      expiresIn: "15m",
    });

    const refreshToken = jwt.sign(
      { userId, email, type: "refresh" },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" }
    );

    return { accessToken, refreshToken };
  }

  // Hash password
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  // Compare password
  async comparePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // Register new user
  async register(input: RegisterInput): Promise<LoginResponse> {
    const { email, password, username, firstName, lastName } = input;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new UserInputError("Email already registered");
      }
      if (existingUser.username === username) {
        throw new UserInputError("Username already taken");
      }
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      username,
      firstName,
      lastName,
      emailVerificationToken,
      emailVerificationExpires,
      isEmailVerified: false,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Generate tokens
    const tokens = this.generateTokens(user._id.toString(), user.email);
    user.refreshToken = tokens.refreshToken;

    await user.save();

    // Send verification email
    try {
      await emailService.sendVerificationEmail(
        user.email,
        emailVerificationToken
      );
    } catch (error) {
      console.error("Failed to send verification email:", error);
    }

    // Remove sensitive data from response
    const userResponse = user.toObject() as any;
    delete userResponse.password;
    delete userResponse.refreshToken;
    delete userResponse.emailVerificationToken;

    return {
      user: userResponse as IUser,
      tokens,
    };
  }

  // Login user
  async login(input: LoginInput): Promise<LoginResponse> {
    const { email, password } = input;

    // Find user
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      throw new AuthenticationError("Invalid email or password");
    }

    // Check if account is locked
    // if (user.accountLocked && user.lockUntil && user.lockUntil > new Date()) {
    //   throw new AuthenticationError(
    //     "Account temporarily locked due to too many failed login attempts"
    //   );
    // }

    // Verify password
    const isValidPassword = await this.comparePassword(password, user.password);
    if (!isValidPassword) {
      // Increment failed login attempts
      await this.handleFailedLogin(user);
      throw new AuthenticationError("Invalid email or password");
    }

    // Reset failed login attempts on successful login
    // if (user.loginAttempts > 0) {
    //   await User.findByIdAndUpdate(user._id, {
    //     $unset: { loginAttempts: 1, lockUntil: 1 },
    //     accountLocked: false,
    //   });
    // }

    // Generate new tokens
    const tokens = this.generateTokens(user._id.toString(), user.email);

    // Update user with new refresh token and last login
    await User.findByIdAndUpdate(user._id, {
      refreshToken: tokens.refreshToken,
      lastLogin: new Date(),
    });

    // Remove sensitive data from response
    const userResponse = user.toObject() as any;
    delete userResponse.password;
    delete userResponse.refreshToken;

    return {
      user: userResponse as IUser,
      tokens,
    };
  }

  // Handle failed login attempts
  private async handleFailedLogin(user: any): Promise<void> {
    const maxAttempts = 5;
    const lockTime = 30 * 60 * 1000; // 30 minutes

    const attempts = (user.loginAttempts || 0) + 1;

    if (attempts >= maxAttempts) {
      await User.findByIdAndUpdate(user._id, {
        loginAttempts: attempts,
        accountLocked: true,
        lockUntil: new Date(Date.now() + lockTime),
      });
    } else {
      await User.findByIdAndUpdate(user._id, {
        loginAttempts: attempts,
      });
    }
  }

  // Refresh access token
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET!
      ) as any;

      if (decoded.type !== "refresh") {
        throw new AuthenticationError("Invalid token type");
      }

      const user = await User.findById(decoded.userId);
      if (!user || user.refreshToken !== refreshToken) {
        throw new AuthenticationError("Invalid refresh token");
      }

      // Generate new access token
      const accessToken = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: "15m" }
      );

      return { accessToken };
    } catch (error) {
      throw new AuthenticationError("Invalid refresh token");
    }
  }

  // Logout user
  async logout(userId: string): Promise<boolean> {
    await User.findByIdAndUpdate(userId, {
      $unset: { refreshToken: 1 },
    });
    return true;
  }

  // Verify email
  async verifyEmail(token: string): Promise<boolean> {
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new UserInputError("Invalid or expired verification token");
    }

    await User.findByIdAndUpdate(user._id, {
      isEmailVerified: true,
      $unset: {
        emailVerificationToken: 1,
        emailVerificationExpires: 1,
      },
    });

    return true;
  }

  // Request password reset
  async requestPasswordReset(email: string): Promise<boolean> {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal whether email exists
      return true;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await User.findByIdAndUpdate(user._id, {
      passwordResetToken: resetToken,
      passwordResetExpires: resetExpires,
    });

    try {
      await emailService.sendPasswordResetEmail(user.email, resetToken);
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      throw new Error("Failed to send reset email");
    }

    return true;
  }

  // Reset password
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new UserInputError("Invalid or expired reset token");
    }

    const hashedPassword = await this.hashPassword(newPassword);

    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      $unset: {
        passwordResetToken: 1,
        passwordResetExpires: 1,
        refreshToken: 1, // Invalidate existing sessions
      },
    });

    return true;
  }

  // Change password (authenticated user)
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    const user = await User.findById(userId).select("+password");
    if (!user) {
      throw new AuthenticationError("User not found");
    }

    const isValidPassword = await this.comparePassword(
      currentPassword,
      user.password
    );
    if (!isValidPassword) {
      throw new AuthenticationError("Current password is incorrect");
    }

    const hashedPassword = await this.hashPassword(newPassword);

    await User.findByIdAndUpdate(userId, {
      password: hashedPassword,
      $unset: { refreshToken: 1 }, // Invalidate existing sessions
    });

    return true;
  }
}

export const authService = new AuthService();
