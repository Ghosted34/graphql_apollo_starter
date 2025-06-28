import jwt from "jsonwebtoken";
import { TokenPayload, AuthTokens, IUser } from "../types";

export class JWTUtils {
  private static accessTokenSecret: any =
    process.env.JWT_ACCESS_SECRET || "access-secret";
  private static refreshTokenSecret: any =
    process.env.JWT_REFRESH_SECRET || "refresh-secret";
  private static accessTokenExpiry: any =
    process.env.JWT_ACCESS_EXPIRES_IN || "15M";
  private static refreshTokenExpiry: any =
    process.env.JWT_REFRESH_EXPIRES_IN || "7D";

  /**
   * Generate access token
   */
  static generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: "graphql-api",
      audience: "graphql-client",
    });
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry,
      issuer: "graphql-api",
      audience: "graphql-client",
    });
  }

  /**
   * Generate both access and refresh tokens
   */
  static generateTokens(user: IUser): AuthTokens {
    const payload: TokenPayload = {
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: "graphql-api",
        audience: "graphql-client",
      }) as TokenPayload;
      return decoded;
    } catch (error) {
      console.error("Access token verification failed:", error);
      return null;
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: "graphql-api",
        audience: "graphql-client",
      }) as TokenPayload;
      return decoded;
    } catch (error) {
      console.error("Refresh token verification failed:", error);
      return null;
    }
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(
    authHeader?: string
  ): string | null | undefined {
    if (!authHeader) return null;

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null;
    }

    return parts[1];
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}
