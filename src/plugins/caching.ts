import { ApolloServerPlugin, GraphQLRequestListener } from "@apollo/server";
import { GraphQLResponse } from "@apollo/server";
import Redis from "ioredis";
import crypto from "crypto";

interface CacheConfig {
  redis: Redis;
  defaultTTL: number;
  keyPrefix: string;
  enableCompression: boolean;
  maxCacheSize: number;
  cachableOperations: string[];
  skipCache: (operationName?: string) => boolean;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  compressed?: boolean;
}

const defaultConfig: Partial<CacheConfig> = {
  defaultTTL: 300, // 5 minutes
  keyPrefix: "graphql:cache:",
  enableCompression: true,
  maxCacheSize: 1000000, // 1MB
  cachableOperations: ["query"],
  skipCache: (operationName) => {
    const skipOperations = ["me", "currentUser", "notifications"];
    return skipOperations.includes(operationName || "");
  },
};

export function responseCachingPlugin(config: CacheConfig): ApolloServerPlugin {
  const finalConfig = { ...defaultConfig, ...config };

  return {
    async requestDidStart(): Promise<GraphQLRequestListener<any>> {
      return {
        async willSendResponse({ request, response, contextValue }) {
          try {
            // Only cache successful queries
            if (
              request.operationName &&
              response.body.kind === "single" &&
              !response.body.singleResult.errors &&
              finalConfig.cachableOperations?.includes(request.operationName) &&
              !finalConfig.skipCache?.(request.operationName)
            ) {
              const cacheKey = generateCacheKey(request);
              const cacheData: CacheEntry = {
                data: response.body.singleResult,
                timestamp: Date.now(),
                ttl: finalConfig.defaultTTL || 300,
              };

              // Compress if enabled and data is large
              let serializedData = JSON.stringify(cacheData);
              if (
                finalConfig.enableCompression &&
                serializedData.length > 1000
              ) {
                const zlib = await import("zlib");
                const compressed = zlib.gzipSync(serializedData);
                if (compressed.length < serializedData.length) {
                  serializedData = compressed.toString("base64");
                  cacheData.compressed = true;
                }
              }

              // Check size limit
              if (
                serializedData.length <= (finalConfig.maxCacheSize || 1000000)
              ) {
                await finalConfig.redis.setex(
                  `${finalConfig.keyPrefix}${cacheKey}`,
                  finalConfig.defaultTTL || 300,
                  serializedData
                );

                // Add cache headers
                if (response.http) {
                  response.http.headers.set("X-Cache", "MISS");
                  response.http.headers.set(
                    "X-Cache-TTL",
                    String(finalConfig.defaultTTL)
                  );
                }
              }
            }
          } catch (error) {
            console.error("Cache write error:", error);
          }
        },

        async responseForOperation({ request, operationName, contextValue }) {
          try {
            // Check if operation should be cached
            if (
              operationName &&
              finalConfig.cachableOperations?.includes("query") &&
              !finalConfig.skipCache?.(operationName)
            ) {
              const cacheKey = generateCacheKey(request);
              const cached = await finalConfig.redis.get(
                `${finalConfig.keyPrefix}${cacheKey}`
              );

              if (cached) {
                let cacheData: CacheEntry;

                try {
                  // Try to parse as JSON first
                  cacheData = JSON.parse(cached);
                } catch {
                  // If parsing fails, try decompression
                  const zlib = await import("zlib");
                  const decompressed = zlib.gunzipSync(
                    Buffer.from(cached, "base64")
                  );
                  cacheData = JSON.parse(decompressed.toString());
                }

                // Check if cache is still valid
                const now = Date.now();
                const age = (now - cacheData.timestamp) / 1000;

                if (age < cacheData.ttl) {
                  const response: GraphQLResponse = {
                    body: {
                      kind: "single",
                      singleResult: cacheData.data,
                    },
                    http: {
                      status: 200,
                      headers: new (await import("@apollo/server")).HeaderMap([
                        ["X-Cache", "HIT"],
                        ["X-Cache-Age", String(Math.floor(age))],
                        ["X-Cache-TTL", String(cacheData.ttl - age)],
                      ]),
                    },
                  };

                  return response;
                }
              }
            }
          } catch (error) {
            console.error("Cache read error:", error);
          }

          return null;
        },
      };
    },
  };
}

// Generate cache key from request
function generateCacheKey(request: any): string {
  const keyData = {
    query: request.query,
    variables: request.variables,
    operationName: request.operationName,
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(keyData))
    .digest("hex");
}

// Cache invalidation utilities
export class CacheInvalidator {
  private redis: Redis;
  private keyPrefix: string;

  constructor(redis: Redis, keyPrefix: string = "graphql:cache:") {
    this.redis = redis;
    this.keyPrefix = keyPrefix;
  }

  // Invalidate specific operation
  async invalidateOperation(operationName: string): Promise<void> {
    const pattern = `${this.keyPrefix}*${operationName}*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // Invalidate by pattern
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(`${this.keyPrefix}${pattern}`);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // Clear all cache
  async clearAll(): Promise<void> {
    const keys = await this.redis.keys(`${this.keyPrefix}*`);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // Get cache statistics
  async getStats(): Promise<{
    totalKeys: number;
    totalMemory: number;
    hitRate: number;
  }> {
    const keys = await this.redis.keys(`${this.keyPrefix}*`);
    const info = await this.redis.info("memory");

    return {
      totalKeys: keys.length,
      totalMemory: parseInt(info.match(/used_memory:(\d+)/)?.[1] || "0"),
      hitRate: 0, // Would need to track hits/misses separately
    };
  }
}

// Field-level caching directive
export const cacheDirectiveTypeDefs = `
  directive @cache(
    ttl: Int = 300
    scope: CacheScope = PUBLIC
  ) on FIELD_DEFINITION

  enum CacheScope {
    PUBLIC
    PRIVATE
  }
`;

// Cache warming utility
export async function warmCache(
  redis: Redis,
  queries: Array<{ query: string; variables?: any; operationName?: string }>,
  keyPrefix: string = "graphql:cache:"
): Promise<void> {
  for (const queryData of queries) {
    try {
      // This would typically involve executing the query and caching the result
      console.log(`Warming cache for operation: ${queryData.operationName}`);
    } catch (error) {
      console.error(
        `Failed to warm cache for ${queryData.operationName}:`,
        error
      );
    }
  }
}
