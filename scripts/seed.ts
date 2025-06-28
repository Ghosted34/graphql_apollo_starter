import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../src/models/User";
import { Post } from "../src/models/Post";
import connectDB from "../src/config/db";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const seedData = {
  users: [
    {
      username: "admin",
      email: "admin@example.com",
      password: "admin123",
      role: "ADMIN",
      isEmailVerified: true,
    },
    {
      username: "john_doe",
      email: "john@example.com",
      password: "password123",
      role: "USER",
      isEmailVerified: true,
    },
    {
      username: "jane_smith",
      email: "jane@example.com",
      password: "password123",
      role: "USER",
      isEmailVerified: true,
    },
    {
      username: "dev_user",
      email: "dev@example.com",
      password: "devpass123",
      role: "USER",
      isEmailVerified: false,
    },
  ],
  posts: [
    {
      title: "Getting Started with GraphQL",
      content: `GraphQL is a query language for APIs and a runtime for fulfilling those queries with your existing data. 
      
GraphQL provides a complete and understandable description of the data in your API, gives clients the power to ask for exactly what they need and nothing more, makes it easier to evolve APIs over time, and enables powerful developer tools.

Key benefits:
- Ask for what you need, get exactly that
- Get many resources in a single request
- Describe what's possible with a type system
- Evolve your API without versions
- Bring your own data and code`,
      tags: ["graphql", "api", "tutorial"],
      published: true,
    },
    {
      title: "Apollo Server Best Practices",
      content: `Apollo Server is a community-driven, open-source GraphQL server that works with many Node.js HTTP server frameworks.

Best practices for Apollo Server:
1. Use DataLoader for efficient data fetching
2. Implement proper error handling
3. Add query complexity analysis
4. Use field-level caching
5. Implement authentication and authorization
6. Monitor performance with Apollo Studio
7. Use schema directives for reusable logic`,
      tags: ["apollo", "graphql", "best-practices"],
      published: true,
    },
    {
      title: "TypeScript with GraphQL",
      content: `TypeScript brings static type checking to JavaScript, making your GraphQL APIs more robust and maintainable.

Benefits of using TypeScript with GraphQL:
- Type safety across your entire stack
- Better IDE support with autocomplete
- Catch errors at compile time
- Generate types from your GraphQL schema
- Improved refactoring capabilities`,
      tags: ["typescript", "graphql", "development"],
      published: true,
    },
    {
      title: "Advanced Query Optimization",
      content: `Query optimization is crucial for GraphQL APIs to prevent performance issues and potential DoS attacks.

Optimization techniques:
1. Query depth limiting
2. Query complexity analysis
3. Rate limiting
4. DataLoader for N+1 problem
5. Field-level caching
6. Persistent queries
7. Query whitelisting`,
      tags: ["optimization", "performance", "graphql"],
      published: false,
    },
    {
      title: "Authentication in GraphQL",
      content: `Implementing secure authentication in GraphQL requires careful consideration of token management and authorization patterns.

Authentication strategies:
- JWT tokens for stateless authentication
- Refresh token rotation
- Role-based access control
- Field-level permissions
- Context-based authorization`,
      tags: ["authentication", "security", "jwt"],
      published: true,
    },
  ],
};

async function clearDatabase() {
  console.log("🗑️  Clearing existing data...");
  await User.deleteMany({});
  await Post.deleteMany({});
  console.log("✅ Database cleared");
}

async function seedUsers() {
  console.log("👥 Seeding users...");

  const createdUsers: (mongoose.Document<unknown, {}, typeof User> & {
    _id: string;
  })[] = [];

  for (const userData of seedData.users) {
    try {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
      console.log(`✅ Created user: ${user.username}`);
    } catch (error) {
      console.error(`❌ Error creating user ${userData.username}:`, error);
    }
  }

  return createdUsers;
}

async function seedPosts(users: any[]) {
  console.log("📝 Seeding posts...");

  const createdPosts: (mongoose.Document<unknown, {}, typeof Post> & {
    _id: string;
  })[] = [];

  for (let i = 0; i < seedData.posts.length; i++) {
    const postData = seedData.posts[i];
    // Assign posts to different users (skip admin)
    const authorIndex = (i % (users.length - 1)) + 1;

    try {
      const post = new Post({
        ...postData,
        author: users[authorIndex]._id,
      });

      await post.save();
      createdPosts.push(post);
      console.log(`✅ Created post: ${post.title}`);
    } catch (error) {
      console.error(`❌ Error creating post ${postData.title}:`, error);
    }
  }

  return createdPosts;
}

async function createIndexes() {
  console.log("🔍 Creating database indexes...");

  try {
    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ username: 1 }, { unique: true });

    // Post indexes
    await Post.collection.createIndex({ author: 1, published: 1 });
    await Post.collection.createIndex({ tags: 1 });
    await Post.collection.createIndex({ createdAt: -1 });
    await Post.collection.createIndex(
      {
        title: "text",
        content: "text",
      },
      {
        weights: { title: 10, content: 5 },
      }
    );

    console.log("✅ Database indexes created");
  } catch (error) {
    console.error("❌ Error creating indexes:", error);
  }
}

async function displaySeedSummary(users: any[], posts: any[]) {
  console.log("\n📊 Seed Summary:");
  console.log(`👥 Users created: ${users.length}`);
  console.log(`📝 Posts created: ${posts.length}`);

  console.log("\n🔑 Test Accounts:");
  console.log("Admin: admin@example.com / admin123");
  console.log("User 1: john@example.com / password123");
  console.log("User 2: jane@example.com / password123");
  console.log("Dev User: dev@example.com / devpass123");

  console.log("\n📈 Statistics:");
  const publishedPosts = posts.filter((post) => post.published).length;
  console.log(`Published posts: ${publishedPosts}`);
  console.log(`Draft posts: ${posts.length - publishedPosts}`);
}

async function main() {
  try {
    console.log("🌱 Starting database seeding...");

    // Connect to database
    await connectDB();

    // Clear existing data
    await clearDatabase();

    // Create indexes
    await createIndexes();

    // Seed data
    const users = await seedUsers();
    const posts = await seedPosts(users);

    // Display summary
    await displaySeedSummary(users, posts);

    console.log("\n🎉 Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("📊 Database connection closed");
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  main();
}

export { main as seedDatabase };
