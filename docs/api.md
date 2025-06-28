# API Documentation

## GraphQL Schema Overview

This document provides comprehensive documentation for the Apollo GraphQL API, including schema definitions, query examples, and authentication requirements.

## Authentication

The API uses JWT-based authentication with access and refresh tokens:

- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (7 days), used to obtain new access tokens

### Headers

Include the access token in requests:

```
Authorization: Bearer <access_token>
```

## Types

### User Type

```graphql
type User {
  id: ID!
  username: String!
  email: String!
  isEmailVerified: Boolean!
  role: UserRole!
  posts: [Post!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum UserRole {
  USER
  ADMIN
  MODERATOR
}
```

### Post Type

```graphql
type Post {
  id: ID!
  title: String!
  content: String!
  published: Boolean!
  author: User!
  tags: [String!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### Auth Types

```graphql
type AuthPayload {
  user: User!
  tokens: TokenPair!
}

type TokenPair {
  accessToken: String!
  refreshToken: String!
}
```

## Queries

### Public Queries (No Authentication Required)

#### Get All Users

```graphql
query GetUsers($limit: Int, $offset: Int) {
  users(limit: $limit, offset: $offset) {
    id
    username
    email
    createdAt
  }
}
```

#### Get User by ID

```graphql
query GetUser($id: ID!) {
  user(id: $id) {
    id
    username
    email
    posts {
      id
      title
      published
    }
  }
}
```

#### Get All Posts

```graphql
query GetPosts($limit: Int, $offset: Int, $published: Boolean) {
  posts(limit: $limit, offset: $offset, published: $published) {
    id
    title
    content
    published
    author {
      username
    }
    tags
    createdAt
  }
}
```

#### Get Post by ID

```graphql
query GetPost($id: ID!) {
  post(id: $id) {
    id
    title
    content
    published
    author {
      id
      username
    }
    tags
    createdAt
    updatedAt
  }
}
```

### Protected Queries (Authentication Required)

#### Get Current User

```graphql
query Me {
  me {
    id
    username
    email
    isEmailVerified
    role
    posts {
      id
      title
      published
    }
    createdAt
  }
}
```

## Mutations

### Authentication Mutations

#### Register

```graphql
mutation Register($input: RegisterInput!) {
  register(input: $input) {
    user {
      id
      username
      email
      isEmailVerified
    }
    tokens {
      accessToken
      refreshToken
    }
  }
}

# Input Type
input RegisterInput {
  username: String!
  email: String!
  password: String!
}
```

#### Login

```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    user {
      id
      username
      email
      role
    }
    tokens {
      accessToken
      refreshToken
    }
  }
}

# Input Type
input LoginInput {
  email: String!
  password: String!
}
```

#### Refresh Token

```graphql
mutation RefreshToken($refreshToken: String!) {
  refreshToken(refreshToken: $refreshToken) {
    accessToken
    refreshToken
  }
}
```

#### Logout

```graphql
mutation Logout {
  logout
}
```

### User Mutations (Protected)

#### Update Profile

```graphql
mutation UpdateProfile($input: UpdateProfileInput!) {
  updateProfile(input: $input) {
    id
    username
    email
    updatedAt
  }
}

# Input Type
input UpdateProfileInput {
  username: String
  email: String
}
```

#### Change Password

```graphql
mutation ChangePassword($input: ChangePasswordInput!) {
  changePassword(input: $input)
}

# Input Type
input ChangePasswordInput {
  currentPassword: String!
  newPassword: String!
}
```

### Post Mutations (Protected)

#### Create Post

```graphql
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    id
    title
    content
    published
    author {
      username
    }
    tags
    createdAt
  }
}

# Input Type
input CreatePostInput {
  title: String!
  content: String!
  published: Boolean = false
  tags: [String!] = []
}
```

#### Update Post

```graphql
mutation UpdatePost($id: ID!, $input: UpdatePostInput!) {
  updatePost(id: $id, input: $input) {
    id
    title
    content
    published
    tags
    updatedAt
  }
}

# Input Type
input UpdatePostInput {
  title: String
  content: String
  published: Boolean
  tags: [String!]
}
```

#### Delete Post

```graphql
mutation DeletePost($id: ID!) {
  deletePost(id: $id)
}
```

## Error Handling

The API returns structured errors with the following format:

```json
{
  "errors": [
    {
      "message": "Authentication required",
      "extensions": {
        "code": "UNAUTHENTICATED",
        "statusCode": 401
      }
    }
  ]
}
```

### Common Error Codes

- `UNAUTHENTICATED`: User not authenticated
- `FORBIDDEN`: Insufficient permissions
- `BAD_USER_INPUT`: Invalid input data
- `NOT_FOUND`: Resource not found
- `INTERNAL_SERVER_ERROR`: Server error
- `USER_INPUT_ERROR`: Validation error

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Default**: 100 requests per 15 minutes per IP
- **Authentication endpoints**: 5 requests per 15 minutes per IP
- **Authenticated users**: Higher limits based on user role

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Query Complexity

To prevent expensive queries, the API implements query complexity analysis:

- **Maximum complexity**: 1000 points
- **Maximum depth**: 10 levels
- **Field costs**: Varies by field type and relationships

Example complexity calculation:

```graphql
# Complexity: ~50 points
query GetUsersWithPosts {
  users(limit: 10) {
    # 10 points
    id # 1 point each
    username # 1 point each
    posts {
      # 3 points each user
      id # 1 point each post
      title # 1 point each post
    }
  }
}
```

## Caching

The API implements intelligent caching:

### Query Caching

- **TTL**: 5 minutes for public data
- **Cache Key**: Based on query + variables
- **Invalidation**: Automatic on mutations

### Example Cache Headers

```
Cache-Control: public, max-age=300
ETag: "W/\"abc123\""
```

## Pagination

Use cursor-based pagination for large datasets:

```graphql
query GetPostsPaginated($first: Int, $after: String) {
  posts(first: $first, after: $after) {
    edges {
      node {
        id
        title
        content
      }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
  }
}
```

## Example Usage Scenarios

### Complete Authentication Flow

```javascript
// 1. Register new user
const registerMutation = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      user { id username email }
      tokens { accessToken refreshToken }
    }
  }
`;

// 2. Store tokens securely
localStorage.setItem("accessToken", tokens.accessToken);
localStorage.setItem("refreshToken", tokens.refreshToken);

// 3. Make authenticated requests
const headers = {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
};

// 4. Handle token refresh
const refreshMutation = `
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      accessToken
      refreshToken  
    }
  }
`;
```

### Blog Post Management

```javascript
// Create a new post
const createPostMutation = `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      id
      title
      content
      published
      createdAt
    }
  }
`;

const variables = {
  input: {
    title: "My GraphQL Journey",
    content: "Learning GraphQL has been amazing...",
    published: true,
    tags: ["graphql", "apollo", "javascript"],
  },
};

// Update existing post
const updatePostMutation = `
  mutation UpdatePost($id: ID!, $input: UpdatePostInput!) {
    updatePost(id: $id, input: $input) {
      id
      title
      content
      updatedAt
    }
  }
`;
```

## Security Best Practices

### Input Validation

- All inputs are validated using Joi schemas
- SQL injection prevention through parameterized queries
- XSS protection via input sanitization

### Authentication Security

- JWT tokens with short expiration times
- Secure HTTP-only cookies for refresh tokens
- CSRF protection for state-changing operations

### Rate Limiting

- IP-based rate limiting
- User-based rate limiting for authenticated requests
- Exponential backoff for repeated failures

## Performance Optimization

### Database Queries

- Efficient MongoDB queries with proper indexing
- DataLoader for N+1 query prevention
- Connection pooling for optimal performance

### Caching Strategy

- Redis for session storage and query caching
- CDN integration for static assets
- Browser caching headers

### Monitoring

- Query performance monitoring
- Error tracking and alerting
- Real-time metrics and dashboards

---

For more detailed information about specific endpoints or advanced usage patterns, refer to the GraphQL Playground at `/graphql` when running the server.
