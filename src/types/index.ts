import { Document, Schema } from "mongoose";

// User Types
export interface IUser extends Document {
  _id: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export enum UserRole {
  USER = "USER",
  ADMIN = "ADMIN",
  MODERATOR = "MODERATOR",
}

// Post Types
export interface IPost extends Document {
  _id: string;
  title: string;
  content: string;
  author: Schema.Types.ObjectId; // User ID
  tags: string[];
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Comment Types
export interface IComment extends Document {
  _id: string;
  content: string;
  author: Schema.Types.ObjectId; // User ID
  post: Schema.Types.ObjectId; // Post ID
  createdAt: Date;
  updatedAt: Date;
}

// Context Types
export interface GraphQLContext {
  user?: IUser;
  isAuthenticated: boolean;
}

// Auth Types
export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

// Pagination Types
export interface PaginationArgs {
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  edges: Array<{
    node: T;
    cursor: string;
  }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
  totalCount: number;
}
