import { gql } from "apollo-server-express";

export const typeDefs = gql`
  # Scalars
  scalar DateTime

  # Enums
  enum UserRole {
    USER
    ADMIN
    MODERATOR
  }

  # User Types
  type User {
    id: ID!
    username: String!
    email: String!
    role: UserRole!
    createdAt: DateTime!
    updatedAt: DateTime!
    posts: [Post!]!
    comments: [Comment!]!
  }

  # Post Types
  type Post {
    id: ID!
    title: String!
    content: String!
    author: User!
    tags: [String!]!
    published: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    comments: [Comment!]!
    commentCount: Int!
  }

  # Comment Types
  type Comment {
    id: ID!
    content: String!
    author: User!
    post: Post!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Authentication Types
  type AuthPayload {
    user: User!
    accessToken: String!
    refreshToken: String!
    expiresIn: Int!
  }

  type RefreshTokenPayload {
    accessToken: String!
    expiresIn: Int!
  }

  # Pagination Types
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type PostEdge {
    node: Post!
    cursor: String!
  }

  type PostConnection {
    edges: [PostEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type CommentEdge {
    node: Comment!
    cursor: String!
  }

  type CommentConnection {
    edges: [CommentEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  # Input Types
  input RegisterInput {
    username: String!
    email: String!
    password: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input CreatePostInput {
    title: String!
    content: String!
    tags: [String!]
    published: Boolean = false
  }

  input UpdatePostInput {
    title: String
    content: String
    tags: [String!]
    published: Boolean
  }

  input CreateCommentInput {
    content: String!
    postId: ID!
  }

  input UpdateCommentInput {
    content: String!
  }

  # Query Types
  type Query {
    # Authentication
    me: User

    # Users
    users(limit: Int = 10, offset: Int = 0): [User!]!
    user(id: ID!): User

    # Posts
    posts(
      limit: Int = 10
      offset: Int = 0
      published: Boolean
      authorId: ID
      tags: [String!]
      search: String
    ): PostConnection!

    post(id: ID!): Post

    myPosts(
      limit: Int = 10
      offset: Int = 0
      published: Boolean
    ): PostConnection!

    # Comments
    comments(postId: ID!, limit: Int = 10, offset: Int = 0): CommentConnection!

    comment(id: ID!): Comment
  }

  # Mutation Types
  type Mutation {
    # Authentication
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    refreshToken(refreshToken: String!): RefreshTokenPayload!
    logout: Boolean!

    # Posts
    createPost(input: CreatePostInput!): Post!
    updatePost(id: ID!, input: UpdatePostInput!): Post!
    deletePost(id: ID!): Boolean!
    publishPost(id: ID!): Post!
    unpublishPost(id: ID!): Post!

    # Comments
    createComment(input: CreateCommentInput!): Comment!
    updateComment(id: ID!, input: UpdateCommentInput!): Comment!
    deleteComment(id: ID!): Boolean!

    # Admin only
    deleteUser(id: ID!): Boolean!
    updateUserRole(id: ID!, role: UserRole!): User!
  }

  # Subscription Types (optional - requires subscription server setup)
  type Subscription {
    postAdded: Post!
    commentAdded(postId: ID!): Comment!
    postUpdated(id: ID!): Post!
  }
`;
