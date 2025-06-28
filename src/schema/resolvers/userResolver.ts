import { GraphQLError } from "graphql";
import { User } from "../../models/User";
import { Post } from "../../models/Post";
import { Comment } from "../../models/Comment";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { GraphQLContext, UserRole } from "../../types";

export const userResolvers = {
  Query: {
    users: async (
      _: any,
      { limit = 10, offset = 0 }: { limit?: number; offset?: number },
      context: GraphQLContext
    ) => {
      requireAuth(context);

      return await User.find()
        .limit(limit)
        .skip(offset)
        .sort({ createdAt: -1 });
    },

    user: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      requireAuth(context);

      const user = await User.findById(id);
      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: {
            code: "USER_NOT_FOUND",
          },
        });
      }

      return user;
    },
  },

  Mutation: {
    deleteUser: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ) => {
      const adminUser = requireAdmin(context);

      if (adminUser._id.toString() === id) {
        throw new GraphQLError("Cannot delete your own admin account", {
          extensions: {
            code: "CANNOT_DELETE_SELF",
          },
        });
      }

      const user = await User.findById(id);
      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: {
            code: "USER_NOT_FOUND",
          },
        });
      }

      // Delete user's posts and comments
      await Post.deleteMany({ author: id });
      await Comment.deleteMany({ author: id });

      // Delete user
      await User.findByIdAndDelete(id);

      return true;
    },

    updateUserRole: async (
      _: any,
      { id, role }: { id: string; role: UserRole },
      context: GraphQLContext
    ) => {
      const adminUser = requireAdmin(context);

      if (adminUser._id.toString() === id) {
        throw new GraphQLError("Cannot modify your own role", {
          extensions: {
            code: "CANNOT_MODIFY_OWN_ROLE",
          },
        });
      }

      const user = await User.findByIdAndUpdate(
        id,
        { role },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: {
            code: "USER_NOT_FOUND",
          },
        });
      }

      return user;
    },
  },

  // Field resolvers for User type
  User: {
    posts: async (parent: any, _: any, context: GraphQLContext) => {
      const currentUser = context.user;

      // If viewing own profile or admin, show all posts
      // Otherwise, only show published posts
      const filter: any = { author: parent.id };

      if (
        !currentUser ||
        (currentUser._id.toString() !== parent.id &&
          currentUser.role !== "ADMIN")
      ) {
        filter.published = true;
      }

      return await Post.find(filter).populate("author").sort({ createdAt: -1 });
    },

    comments: async (parent: any, _: any, context: GraphQLContext) => {
      const currentUser = context.user;

      // Build aggregation pipeline to only show comments on published posts
      // unless viewing own profile or admin
      const pipeline: any[] = [
        { $match: { author: parent._id } },
        {
          $lookup: {
            from: "posts",
            localField: "post",
            foreignField: "_id",
            as: "postData",
          },
        },
        { $unwind: "$postData" },
      ];

      // Filter comments based on post visibility
      if (
        !currentUser ||
        (currentUser._id.toString() !== parent.id &&
          currentUser.role !== "ADMIN")
      ) {
        pipeline.push({ $match: { "postData.published": true } });
      }

      pipeline.push(
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: "users",
            localField: "author",
            foreignField: "_id",
            as: "author",
          },
        },
        { $unwind: "$author" },
        {
          $lookup: {
            from: "posts",
            localField: "post",
            foreignField: "_id",
            as: "post",
          },
        },
        { $unwind: "$post" }
      );

      const comments = await Comment.aggregate(pipeline);
      return comments;
    },
  },
};
