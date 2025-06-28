import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { User } from "../models/User";
import { AuthenticationError } from "apollo-server-express";
import { JWTUtils } from "../utils";
import { GraphQLContext } from "../types";

export interface AuthenticatedRequest extends Request {
  user?: any;
}

/**
 * Create GraphQL context with authentication
 */
export const createContext = async (req: any): Promise<GraphQLContext> => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = JWTUtils.extractTokenFromHeader(authHeader);

  if (!token) {
    return {
      isAuthenticated: false,
    };
  }

  try {
    const payload = JWTUtils.verifyAccessToken(token);
    if (!payload) {
      return {
        isAuthenticated: false,
      };
    }

    // Fetch fresh user data
    const user = await User.findById(payload.userId);
    if (!user) {
      return {
        isAuthenticated: false,
      };
    }

    return {
      user,
      isAuthenticated: true,
    };
  } catch (error) {
    console.error("Auth context creation error:", error);
    return {
      isAuthenticated: false,
    };
  }
};

// JWT Authentication middleware for Express
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const user = await User.findById(decoded.userId).select(
          "-password -refreshToken"
        );

        if (user) {
          req.user = user;
        }
      } catch (error) {
        console.log(
          "Invalid token:",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    next();
  }
};

// GraphQL Context authentication helper
export const requireAuth = (context: any) => {
  if (!context) {
    throw new AuthenticationError(
      "You must be logged in to perform this action"
    );
  }
  return context.user;
};

// Role-based authorization helper
export const requireRole = (user: any, requiredRoles: string[]) => {
  requireAuth(user);

  if (!requiredRoles.includes(user.role)) {
    throw new AuthenticationError(
      `Insufficient permissions. Required roles: ${requiredRoles.join(", ")}`
    );
  }

  return user;
};

// Admin authorization helper
export const requireAdmin = (user: any) => {
  return requireRole(user, ["admin"]);
};

// Owner or Admin authorization helper
export const requireOwnerOrAdmin = (user: any, resourceUserId: string) => {
  requireAuth(user);

  if (
    user.role !== "admin" &&
    user._id.toString() !== resourceUserId.toString()
  ) {
    throw new AuthenticationError("You can only access your own resources");
  }

  return user;
};

export const requireOwnership = (user: any, resourceUserId: string) => {
  requireAuth(user);

  if (
    user.role !== "admin" &&
    user._id.toString() !== resourceUserId.toString()
  ) {
    throw new AuthenticationError("You can only access your own resources");
  }

  return user;
};
