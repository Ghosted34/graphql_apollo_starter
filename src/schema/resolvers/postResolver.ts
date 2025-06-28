import { GraphQLError } from "graphql";
import { Post } from "../../models/Post";
import { Comment } from "../../models/Comment";
import { User } from "../../models/User";
import { requireAuth, requireOwnership } from "../../middleware/auth";
import { GraphQLContext, PaginatedResponse, IPost } from "../../types";

interface PostsArgs {
  limit?: number;
  offset?: number;
  published?: boolean;
  authorId?: string;
  tags?: string[];
  search?: string;
}

interface CreatePostInput {
  title: string;
  content: string;
  tags?: string[];
  published?: boolean;
}

interface UpdatePostInput {
  title?: string;
  content?: string;
  tags?: string[];
  published?: boolean;
}

export const postResolvers = {
  Query: {
    posts: async (_: any, args: PostsArgs, context: GraphQLContext) => {
      const {
        limit = 10,
        offset = 0,
        published,
        authorId,
        tags,
        search,
      } = args;

      // Build filter
      const filter: any = {};

      // If user is not authenticated or is not viewing their own posts, only show published
      if (published !== undefined) {
        filter.published = published;
      } else if (
        !context.isAuthenticated ||
        !authorId ||
        context.user?._id.toString() !== authorId
      ) {
        filter.published = true;
      }

      if (authorId) {
        filter.author = authorId;
      }

      if (tags && tags.length > 0) {
        filter.tags = { $in: tags };
      }

      if (search) {
        filter.$text = { $search: search };
      }

      // Execute queries
      const [posts, totalCount] = await Promise.all([
        Post.find(filter)
          .populate("author")
          .sort(search ? { score: { $meta: "textScore" } } : { createdAt: -1 })
          .limit(limit)
          .skip(offset),
        Post.countDocuments(filter),
      ]);

      // Build cursor-based pagination response
      const edges = posts.map((post, index) => ({
        node: post,
        cursor: Buffer.from(`${offset + index}`).toString("base64"),
      }));

      const hasNextPage = offset + limit < totalCount;
      const hasPreviousPage = offset > 0;

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges.length > 0 ? edges[0]?.cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1]?.cursor : null,
        },
        totalCount,
      };
    },

    post: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const post = await Post.findById(id).populate("author");

      if (!post) {
        throw new GraphQLError("Post not found", {
          extensions: {
            code: "POST_NOT_FOUND",
          },
        });
      }

      // Check if user can view unpublished post
      if (!post.published) {
        if (!context.isAuthenticated) {
          throw new GraphQLError("Post not found", {
            extensions: {
              code: "POST_NOT_FOUND",
            },
          });
        }

        const user = context.user!;
        if (
          user._id.toString() !== post.author.toString() &&
          user.role !== "ADMIN"
        ) {
          throw new GraphQLError("Post not found", {
            extensions: {
              code: "POST_NOT_FOUND",
            },
          });
        }
      }

      return post;
    },

    myPosts: async (
      _: any,
      {
        limit = 10,
        offset = 0,
        published,
      }: { limit?: number; offset?: number; published?: boolean },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      const filter: any = { author: user._id };
      if (published !== undefined) {
        filter.published = published;
      }

      const [posts, totalCount] = await Promise.all([
        Post.find(filter)
          .populate("author")
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(offset),
        Post.countDocuments(filter),
      ]);

      const edges = posts.map((post, index) => ({
        node: post,
        cursor: Buffer.from(`${offset + index}`).toString("base64"),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + limit < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges.length > 0 ? edges[0]?.cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1]?.cursor : null,
        },
        totalCount,
      };
    },
  },

  Mutation: {
    createPost: async (
      _: any,
      { input }: { input: CreatePostInput },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      const post = new Post({
        title: input.title,
        content: input.content,
        author: user._id,
        tags: input.tags || [],
        published: input.published || false,
      });

      await post.save();
      await post.populate("author");

      return post;
    },

    updatePost: async (
      _: any,
      { id, input }: { id: string; input: UpdatePostInput },
      context: GraphQLContext
    ) => {
      const post = await Post.findById(id);

      if (!post) {
        throw new GraphQLError("Post not found", {
          extensions: {
            code: "POST_NOT_FOUND",
          },
        });
      }

      // Check ownership
      requireOwnership(context, post.author.toString());

      const updatedPost = await Post.findByIdAndUpdate(
        id,
        { ...input },
        { new: true, runValidators: true }
      ).populate("author");

      return updatedPost;
    },

    deletePost: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ) => {
      const post = await Post.findById(id);

      if (!post) {
        throw new GraphQLError("Post not found", {
          extensions: {
            code: "POST_NOT_FOUND",
          },
        });
      }

      // Check ownership
      requireOwnership(context, post.author.toString());

      // Delete associated comments
      await Comment.deleteMany({ post: id });

      // Delete post
      await Post.findByIdAndDelete(id);

      return true;
    },

    publishPost: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ) => {
      const post = await Post.findById(id);

      if (!post) {
        throw new GraphQLError("Post not found", {
          extensions: {
            code: "POST_NOT_FOUND",
          },
        });
      }

      // Check ownership
      requireOwnership(context, post.author.toString());

      const updatedPost = await Post.findByIdAndUpdate(
        id,
        { published: true },
        { new: true }
      ).populate("author");

      return updatedPost;
    },

    unpublishPost: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ) => {
      const post = await Post.findById(id);

      if (!post) {
        throw new GraphQLError("Post not found", {
          extensions: {
            code: "POST_NOT_FOUND",
          },
        });
      }

      // Check ownership
      requireOwnership(context, post.author.toString());

      const updatedPost = await Post.findByIdAndUpdate(
        id,
        { published: false },
        { new: true }
      ).populate("author");

      return updatedPost;
    },
  },

  // Field resolvers for Post type
  Post: {
    comments: async (parent: any) => {
      return await Comment.find({ post: parent.id })
        .populate("author")
        .sort({ createdAt: -1 });
    },

    commentCount: async (parent: any) => {
      return await Comment.countDocuments({ post: parent.id });
    },
  },
};
