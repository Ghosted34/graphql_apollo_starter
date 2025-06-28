import { ApolloServerPlugin, GraphQLRequestListener } from "@apollo/server";
import winston from "winston";
import { GraphQLError } from "graphql";

interface LoggingConfig {
  logger: winston.Logger;
  logLevel: string;
  logRequests: boolean;
  logResponses: boolean;
  logErrors: boolean;
  logSlowQueries: boolean;
  slowQueryThreshold: number;
  includeVariables: boolean;
  includeQuery: boolean;
  excludeOperations: string[];
  maskSensitiveData: boolean;
  sensitiveFields: string[];
}

const defaultConfig: LoggingConfig = {
  logger: winston.createLogger({
    level: "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: "logs/graphql.log" }),
    ],
  }),
  logLevel: "info",
  logRequests: true,
  logResponses: false,
  logErrors: true,
  logSlowQueries: true,
  slowQueryThreshold: 1000, // 1 second
  includeVariables: true,
  includeQuery: true,
  excludeOperations: ["IntrospectionQuery"],
  maskSensitiveData: true,
  sensitiveFields: ["password", "token", "secret", "key", "auth"],
};

export function requestLoggingPlugin(
  config: Partial<LoggingConfig> = {}
): ApolloServerPlugin {
  const finalConfig = { ...defaultConfig, ...config };

  return {
    async requestDidStart(): Promise<GraphQLRequestListener<any>> {
      const startTime = Date.now();
      let operationName: string | undefined;
      let queryHash: string | undefined;

      return {
        async didResolveOperation({ request, operationName: opName }) {
          operationName = opName || "UnknownOperation";
          queryHash = generateQueryHash(request.query || "");

          // Skip excluded operations
          if (finalConfig.excludeOperations.includes(operationName)) {
            return;
          }

          if (finalConfig.logRequests) {
            const logData = {
              type: "GraphQL Request",
              operationName,
              queryHash,
              timestamp: new Date().toISOString(),
              variables: finalConfig.includeVariables
                ? maskSensitiveData(
                    request.variables || {},
                    finalConfig.sensitiveFields
                  )
                : undefined,
              query: finalConfig.includeQuery ? request.query : undefined,
              userAgent: request.http?.headers.get("user-agent"),
              ip: getClientIP(request),
              userId: getUserId(request),
            };

            finalConfig.logger.info("GraphQL request received", logData);
          }
        },

        async willSendResponse({ response, contextValue }) {
          const duration = Date.now() - startTime;

          // Skip excluded operations
          if (
            operationName &&
            finalConfig.excludeOperations.includes(operationName)
          ) {
            return;
          }

          // Log slow queries
          if (
            finalConfig.logSlowQueries &&
            duration > finalConfig.slowQueryThreshold
          ) {
            finalConfig.logger.warn("Slow GraphQL query detected", {
              type: "Slow Query",
              operationName,
              queryHash,
              duration,
              threshold: finalConfig.slowQueryThreshold,
              timestamp: new Date().toISOString(),
            });
          }

          // Log responses if enabled
          if (finalConfig.logResponses) {
            const logData = {
              type: "GraphQL Response",
              operationName,
              queryHash,
              duration,
              timestamp: new Date().toISOString(),
              hasErrors:
                response.body.kind === "single" &&
                !!response.body.singleResult.errors,
              cacheStatus: response.http?.headers.get("X-Cache"),
            };

            finalConfig.logger.info("GraphQL response sent", logData);
          }

          // Add performance headers
          if (response.http) {
            response.http.headers.set("X-Response-Time", `${duration}ms`);
            response.http.headers.set(
              "X-Operation-Name",
              operationName || "unknown"
            );
          }
        },

        async didEncounterErrors({ errors, contextValue }) {
          if (!finalConfig.logErrors) return;

          const duration = Date.now() - startTime;

          for (const error of errors) {
            const logData = {
              type: "GraphQL Error",
              operationName,
              queryHash,
              duration,
              timestamp: new Date().toISOString(),
              error: {
                message: error.message,
                code: error.extensions?.code,
                path: error.path,
                locations: error.locations,
                stack: error.stack,
              },
              userId: getUserId({ contextValue } as any),
            };

            if (isOperationalError(error)) {
              finalConfig.logger.warn("GraphQL operational error", logData);
            } else {
              finalConfig.logger.error("GraphQL system error", logData);
            }
          }
        },
      };
    },
  };
}

// Utility functions
function generateQueryHash(query: string): string {
  const crypto = require("crypto");
  return crypto.createHash("md5").update(query).digest("hex").substring(0, 8);
}

function getClientIP(request: any): string | undefined {
  return (
    request.http?.headers.get("x-forwarded-for") ||
    request.http?.headers.get("x-real-ip") ||
    request.http?.req?.connection?.remoteAddress
  );
}

function getUserId(request: any): string | undefined {
  return (
    request.contextValue?.user?.id ||
    request.contextValue?.userId ||
    request.http?.headers.get("x-user-id")
  );
}

function maskSensitiveData(data: any, sensitiveFields: string[]): any {
  if (!data || typeof data !== "object") return data;

  const masked = { ...data };

  for (const field of sensitiveFields) {
    if (field in masked) {
      masked[field] = "***MASKED***";
    }
  }

  // Recursively mask nested objects
  for (const key in masked) {
    if (typeof masked[key] === "object" && masked[key] !== null) {
      masked[key] = maskSensitiveData(masked[key], sensitiveFields);
    }
  }

  return masked;
}

function isOperationalError(error: GraphQLError): boolean {
  const operationalCodes = [
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "BAD_USER_INPUT",
    "NOT_FOUND",
    "QUERY_COMPLEXITY_LIMIT_EXCEEDED",
    "RATE_LIMITED",
  ];

  return operationalCodes.includes(error.extensions?.code as string);
}

// Custom logger for different environments
export function createLogger(
  environment: string = "development"
): winston.Logger {
  const isDevelopment = environment === "development";
  const isProduction = environment === "production";

  const formats = [
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
  ];

  if (isDevelopment) {
    formats.push(winston.format.colorize(), winston.format.simple());
  } else {
    formats.push(winston.format.json());
  }

  const transports: winston.transport[] = [];

  if (isDevelopment) {
    transports.push(new winston.transports.Console());
  }

  if (isProduction) {
    transports.push(
      new winston.transports.File({
        filename: "logs/error.log",
        level: "error",
      }),
      new winston.transports.File({
        filename: "logs/combined.log",
      })
    );
  }

  return winston.createLogger({
    level: isDevelopment ? "debug" : "info",
    format: winston.format.combine(...formats),
    transports,
    exitOnError: false,
  });
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  recordQueryTime(operationName: string, duration: number): void {
    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, []);
    }
    this.metrics.get(operationName)!.push(duration);
  }

  getStats(operationName: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const times = this.metrics.get(operationName);
    if (!times || times.length === 0) return null;

    const sorted = [...times].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const p95Index = Math.floor(count * 0.95);

    return {
      count,
      average: sum / count,
      min: sorted[0] || 0,
      max: sorted[count - 1] || 0,
      p95: sorted[p95Index] || 0,
    };
  }

  logStats(): void {
    for (const [operationName, times] of this.metrics.entries()) {
      const stats = this.getStats(operationName);
      if (stats) {
        this.logger.info("Performance stats", {
          operationName,
          ...stats,
        });
      }
    }
  }

  reset(): void {
    this.metrics.clear();
  }
}
