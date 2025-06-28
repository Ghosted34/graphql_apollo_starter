import dotenv from "dotenv";
import connectDB from "./config/db";
import { createApolloServer } from "./app";

// Load environment variables
dotenv.config();

// Global error handlers
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

async function startServer() {
  try {
    console.log("🚀 Starting Apollo GraphQL Server...");

    // Connect to database
    console.log("📦 Connecting to database...");
    await connectDB();
    console.log("✅ Database connected successfully");

    // Create Apollo server with Express
    console.log("🔧 Creating Apollo Server...");
    const { app, httpServer, server } = await createApolloServer();

    // Start server
    const port = process.env.PORT || 4000;
    await new Promise<void>((resolve) => {
      httpServer.listen(port, resolve);
    });

    console.log(`🚀 Server ready at http://localhost:${port}/graphql`);
    console.log(`📊 Health check available at http://localhost:${port}/health`);
    console.log(
      `🔍 GraphQL Playground available at http://localhost:${port}/graphql`
    );
    console.log(
      `🔄 Token refresh endpoint at http://localhost:${port}/auth/refresh`
    );

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

      try {
        // Stop accepting new connections
        await new Promise<void>((resolve) => {
          httpServer.close(() => {
            console.log("✅ HTTP server closed");
            resolve();
          });
        });

        // Stop Apollo Server
        await server.stop();
        console.log("✅ Apollo Server stopped");

        // Close database connection
        console.log("✅ Database connection closed");

        console.log("🔄 Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        console.error("❌ Error during graceful shutdown:", error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  } catch (error) {
    console.error("❌ Error starting server:", error);
    process.exit(1);
  }
}

// Start the application
startServer();
