import { GraphQLScalarType, GraphQLError } from "graphql";
import { Kind } from "graphql/language";

export const scalarResolvers = {
  DateTime: new GraphQLScalarType({
    name: "DateTime",
    description: "Date custom scalar type",
    serialize(value: any) {
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === "string" || typeof value === "number") {
        return new Date(value).toISOString();
      }
      throw new GraphQLError(`Value is not a valid Date: ${value}`);
    },
    parseValue(value: any) {
      if (typeof value === "string" || typeof value === "number") {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new GraphQLError(`Value is not a valid Date: ${value}`);
        }
        return date;
      }
      throw new GraphQLError(`Value is not a valid Date: ${value}`);
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING || ast.kind === Kind.INT) {
        const date = new Date(ast.value);
        if (isNaN(date.getTime())) {
          throw new GraphQLError(`Value is not a valid Date: ${ast.value}`);
        }
        return date;
      }
      throw new GraphQLError(
        `Can only parse strings and integers to dates but got a: ${ast.kind}`
      );
    },
  }),
};
