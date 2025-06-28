import express from "express";
import http from "http";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "./schema/typeDefs";
import { resolvers } from "./schema/resolvers";
import { createContext } from "./middleware/auth";
import { responseCachingPlugin } from "./plugins/caching";
import { complexityAnalysisPlugin } from "./plugins/complexityAnalysis";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

export async function createApolloServer() {
  // Create Express app
  const app = express();

  // CORS configuration
  const corsOptions = {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  };
  app.use(cors(corsOptions));
  app.use(express.json());

  // Create HTTP server
  const httpServer = http.createServer(app);

  // Create GraphQL schema
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  // Create Apollo Server instance
  const server = new ApolloServer({
    schema,
    csrfPrevention: true,
    cache: "bounded",
    introspection: process.env.NODE_ENV === "development",
    formatError: (formattedError, error) => {
      if (process.env.NODE_ENV === "development") {
        console.error("GraphQL Error:", error);
      }

      return {
        message: formattedError.message,
        locations: formattedError.locations ?? [],
        path: formattedError.path ?? [],
        extensions: formattedError.extensions ?? {},
      };
    },
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async requestDidStart() {
          return {
            async didResolveOperation(requestContext) {
              if (process.env.NODE_ENV === "development") {
                console.log(
                  `GraphQL Operation: ${
                    requestContext.request.operationName || "Unnamed"
                  }`
                );
              }
            },
            async didEncounterErrors(requestContext) {
              if (process.env.NODE_ENV === "development") {
                console.error(
                  "GraphQL Execution Errors:",
                  requestContext.errors
                );
              }
            },
          };
        },
      },
      complexityAnalysisPlugin(schema, {
        maximumComplexity: 500,
        onComplete: (complexity, depth) => {
          console.log(`[Complexity] Cost: ${complexity}, Depth: ${depth}`);
        },
      }),
      responseCachingPlugin({
        redis,
        defaultTTL: 300,
        keyPrefix: "graphql:cache:",
        cachableOperations: ["query"],
        skipCache: (opName) => ["me", "notifications"].includes(opName || ""),
        enableCompression: true,
        maxCacheSize: 1024 * 1024,
      }),
    ],
  });

  // Start Apollo Server
  await server.start();

  // Apply Apollo middleware
  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req }) => {
        try {
          return await createContext(req);
        } catch (error) {
          console.error("Error creating context:", error);
          return {};
        }
      },
    })
  );

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  return { app, httpServer, server };
}
