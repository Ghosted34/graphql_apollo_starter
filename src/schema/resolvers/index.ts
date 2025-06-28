import { authResolvers } from "./authResolver";
import { userResolvers } from "./userResolver";
import { postResolvers } from "./postResolver";
import { commentResolvers } from "./commentResolver";
import { scalarResolvers } from "./scalarResolver";

// Merge all resolvers
export const resolvers: any = {
  // Scalar resolvers
  ...scalarResolvers,

  Query: {
    ...authResolvers.Query,
    ...userResolvers.Query,
    ...postResolvers.Query,
    ...commentResolvers.Query,
  },

  Mutation: {
    ...authResolvers.Mutation,
    ...userResolvers.Mutation,
    ...postResolvers.Mutation,
    ...commentResolvers.Mutation,
  },

  // Type resolvers
  User: userResolvers.User,
  Post: postResolvers.Post,
};
