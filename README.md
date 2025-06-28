# Apollo GraphQL API

A robust GraphQL API built with Apollo Server, Express, TypeScript, and MongoDB. Features comprehensive authentication, query optimization, and production-ready architecture.

## 🚀 Features

- **GraphQL API** with Apollo Server v4
- **Authentication & Authorization** with JWT tokens (access + refresh)
- **Query Optimization** with complexity analysis and rate limiting
- **Type Safety** with TypeScript throughout
- **Database** MongoDB with Mongoose ODM
- **Caching** Redis for sessions and query caching
- **Testing** Comprehensive test suite with Jest
- **Docker Support** Full containerization
- **Production Ready** with logging, monitoring, and security

## 📋 Prerequisites

- Node.js 18+
- MongoDB
- Redis
- Docker (optional)

## 🛠️ Installation

### Local Development

1. **Clone the repository**

```bash
git clone <repository-url>
cd apollo-graphql-api
```

2. **Install dependencies**

```bash
npm install
```

3. **Environment setup**

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start services** (MongoDB & Redis)

```bash
# Option 1: Using Docker
docker-compose up mongodb redis

# Option 2: Local installations
# Start MongoDB and Redis on your system
```

5. **Run the application**

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

### Docker Development

```bash
# Start all services
docker-compose up

# Development with hot reload
docker-compose up api

# Production build
docker-compose -f docker-compose.prod.yml up
```

## 🏗️ Project Structure

```
apollo-graphql-api/
├── src/
│   ├── config/          # Database and Redis configuration
│   ├── middleware/      # Authentication, rate limiting, validation
│   ├── models/          # MongoDB models (User, Post)
│   ├── schema/          # GraphQL type definitions and resolvers
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions and helpers
│   ├── types/           # TypeScript type definitions
│   ├── plugins/         # Apollo Server plugins
│   ├── app.ts           # Express Apollo Server setup
│   └── server.ts        # Express Apollo Server Start
├── docs/                # API documentation
└── docker-compose.yml   # Docker configuration
```

## 🔧 Configuration

### Environment Variables

Key environment variables (see `.env.example` for complete list):

```bash
# Server
NODE_ENV=development
PORT=4000

# Database
DATABASE_URL=mongodb://localhost:27017/apollo-api
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Client
CLIENT_URL=http://localhost:3000
```

## 📡 API Usage

### GraphQL Endpoint

```
http://localhost:4000/graphql
```

### Authentication Flow

1. **Register a new user**

```graphql
mutation Register {
  register(
    input: {
      email: "user@example.com"
      password: "securePassword123"
      username: "johndoe"
    }
  ) {
    user {
      id
      email
      username
    }
    tokens {
      accessToken
      refreshToken
    }
  }
}
```

2. **Login**

```graphql
mutation Login {
  login(input: { email: "user@example.com", password: "securePassword123" }) {
    user {
      id
      email
      username
    }
    tokens {
      accessToken
      refreshToken
    }
  }
}
```

3. **Query with authentication**

```graphql
# Include in headers:
# Authorization: Bearer <your-access-token>

query Me {
  me {
    id
    email
    username
    posts {
      id
      title
      content
    }
  }
}
```

### Example Queries

**Get all users**

```graphql
query GetUsers {
  users {
    id
    username
    email
    createdAt
  }
}
```

**Create a post**

```graphql
mutation CreatePost {
  createPost(
    input: { title: "My First Post", content: "This is the content of my post" }
  ) {
    id
    title
    content
    author {
      username
    }
  }
}
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Specific test suite
npm test -- --testPathPattern=auth
```

## 🚀 Deployment

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Docker Production

```bash
# Build production image
docker build -t apollo-api:prod .

# Run production container
docker run -p 4000:4000 apollo-api:prod
```

## 📊 Performance & Security

### Query Optimization

- **Complexity Analysis**: Prevents expensive queries
- **Rate Limiting**: Configurable per-endpoint limits
- **Caching**: Redis-based response caching
- **Query Depth Limiting**: Prevents deeply nested queries

### Security Features

- **JWT Authentication**: Secure token-based auth
- **Input Validation**: Joi-based validation
- **CORS Protection**: Configurable origins
- **Helmet**: Security headers
- **Rate Limiting**: DDoS protection

## 🔍 Monitoring & Logging

- **Winston Logger**: Structured logging
- **Request Logging**: All GraphQL operations
- **Error Tracking**: Comprehensive error handling
- **Health Checks**: `/health` endpoint

## 📚 API Documentation

- GraphQL Playground: `http://localhost:4000/graphql`
- Schema Documentation: Auto-generated from type definitions
- Detailed docs in `/docs/api.md`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the documentation in `/docs`
- Review the example queries in GraphQL Playground

---

Built with ❤️ using Apollo Server, Express, and TypeScript
