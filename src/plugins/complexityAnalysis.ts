import { ApolloServerPlugin, GraphQLRequestListener } from "@apollo/server";
import { GraphQLError } from "graphql";
import {
  getComplexity,
  createComplexityRule,
  fieldExtensionsEstimator,
  simpleEstimator,
} from "graphql-query-complexity";
import depthLimit from "graphql-depth-limit";
import { GraphQLSchema } from "graphql";

interface ComplexityAnalysisConfig {
  maximumComplexity: number;
  maximumDepth: number;
  scalarCost: number;
  objectCost: number;
  listFactor: number;
  introspectionCost: number;
  createError: (max: number, actual: number) => GraphQLError;
  onComplete?: (complexity: number, depth: number) => void;
}

const defaultConfig: ComplexityAnalysisConfig = {
  maximumComplexity: 1000,
  maximumDepth: 10,
  scalarCost: 1,
  objectCost: 2,
  listFactor: 10,
  introspectionCost: 1000,
  createError: (max: number, actual: number) =>
    new GraphQLError(
      `Query complexity limit of ${max} exceeded, found ${actual}.`,
      {
        extensions: {
          code: "QUERY_COMPLEXITY_LIMIT_EXCEEDED",
          complexity: actual,
          maxComplexity: max,
        },
      }
    ),
};

export function complexityAnalysisPlugin(
  schema: GraphQLSchema,
  config: Partial<ComplexityAnalysisConfig> = {}
): ApolloServerPlugin {
  const finalConfig = { ...defaultConfig, ...config };

  return {
    async requestDidStart(): Promise<GraphQLRequestListener<any>> {
      return {
        async didResolveOperation({ request, document }) {
          try {
            // Calculate query complexity
            const complexity = getComplexity({
              schema,
              query: document,
              variables: request.variables ?? {}, // ✅ Ensure it's always an object
              estimators: [
                fieldExtensionsEstimator(),
                simpleEstimator({
                  defaultComplexity: finalConfig.scalarCost,
                }),
              ],
            });

            // Check complexity limit
            if (complexity > finalConfig.maximumComplexity) {
              throw finalConfig.createError(
                finalConfig.maximumComplexity,
                complexity
              );
            }

            // Validate query depth
            const depthValidationRules = [depthLimit(finalConfig.maximumDepth)];

            // Store complexity info for logging
            if (request.http?.body) {
              (request.http.body as any).queryComplexity = complexity;
            }

            // Call completion callback if provided
            if (finalConfig.onComplete) {
              finalConfig.onComplete(complexity, finalConfig.maximumDepth);
            }
          } catch (error) {
            if (error instanceof GraphQLError) {
              throw error;
            }

            throw new GraphQLError("Query complexity analysis failed", {
              extensions: {
                code: "COMPLEXITY_ANALYSIS_ERROR",
                originalError: error,
              },
            });
          }
        },
      };
    },
  };
}

// Custom complexity estimators for specific fields
export const customComplexityEstimators = {
  // Expensive database operations
  users: { complexity: 10, multipliers: ["first", "last"] },
  posts: { complexity: 5, multipliers: ["first", "last"] },
  comments: { complexity: 3, multipliers: ["first", "last"] },

  // Search operations
  search: { complexity: 20, multipliers: ["limit"] },

  // Aggregation operations
  userStats: { complexity: 15 },
  postAnalytics: { complexity: 25 },

  // File operations
  uploadFile: { complexity: 50 },
  processImage: { complexity: 30 },
};

// Utility function to create complexity rules
export function createComplexityRules(maxComplexity: number = 1000) {
  return [
    createComplexityRule({
      maximumComplexity: maxComplexity,
      onComplete: (cost: number) => {
        console.log(`Query complexity: ${cost}`);
      },
      estimators: [
        fieldExtensionsEstimator(),
        simpleEstimator({
          defaultComplexity: 1,
        }),
      ],
    }),
  ];
}

// Helper function to get complexity from request
export function getRequestComplexity(req: any): number | null {
  return req?.queryComplexity || null;
}

// Complexity analysis middleware for express
export function complexityAnalysisMiddleware(
  schema: GraphQLSchema,
  config: Partial<ComplexityAnalysisConfig> = {}
) {
  const finalConfig = { ...defaultConfig, ...config };

  return (req: any, res: any, next: any) => {
    // Add complexity analysis to request context
    req.complexityConfig = finalConfig;
    req.graphqlSchema = schema;
    next();
  };
}
