import { GraphQLError } from "graphql";
import { Comment } from "../../models/Comment";
import { Post } from "../../models/Post";
import { requireAuth, requireOwnership } from "../../middleware/auth";
import { GraphQLContext } from "../../types";

interface CreateCommentInput {
  content: string;
  postId: string;
}

interface UpdateCommentInput {
  content: string;
}

interface CommentsArgs {
  postId: string;
  limit?: number;
  offset?: number;
}

export const commentResolvers = {
  Query: {
    comments: async (
      _: any,
      { postId, limit = 10, offset = 0 }: CommentsArgs,
      context: GraphQLContext
    ) => {
      // Check if post exists and is accessible
      const post = await Post.findById(postId);

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

      // Get comments with pagination
      const [comments, totalCount] = await Promise.all([
        Comment.find({ post: postId })
          .populate("author")
          .populate("post")
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(offset),
        Comment.countDocuments({ post: postId }),
      ]);

      const edges = comments.map((comment, index) => ({
        node: comment,
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

    comment: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ) => {
      const comment = await Comment.findById(id)
        .populate("author")
        .populate("post");

      if (!comment) {
        throw new GraphQLError("Comment not found", {
          extensions: {
            code: "COMMENT_NOT_FOUND",
          },
        });
      }

      // Check if the associated post is accessible
      const post = comment.post as any;
      if (!post.published) {
        if (!context.isAuthenticated) {
          throw new GraphQLError("Comment not found", {
            extensions: {
              code: "COMMENT_NOT_FOUND",
            },
          });
        }

        const user = context.user!;
        if (
          user._id.toString() !== post.author.toString() &&
          user.role !== "ADMIN"
        ) {
          throw new GraphQLError("Comment not found", {
            extensions: {
              code: "COMMENT_NOT_FOUND",
            },
          });
        }
      }

      return comment;
    },
  },

  Mutation: {
    createComment: async (
      _: any,
      { input }: { input: CreateCommentInput },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      // Check if post exists and is published
      const post = await Post.findById(input.postId);

      if (!post) {
        throw new GraphQLError("Post not found", {
          extensions: {
            code: "POST_NOT_FOUND",
          },
        });
      }

      // Only allow comments on published posts unless user is the author or admin
      if (!post.published) {
        if (
          user._id.toString() !== post.author.toString() &&
          user.role !== "ADMIN"
        ) {
          throw new GraphQLError("Cannot comment on unpublished post", {
            extensions: {
              code: "POST_NOT_PUBLISHED",
            },
          });
        }
      }

      const comment = new Comment({
        content: input.content,
        author: user._id,
        post: input.postId,
      });

      await comment.save();
      await comment.populate(["author", "post"]);

      return comment;
    },

    updateComment: async (
      _: any,
      { id, input }: { id: string; input: UpdateCommentInput },
      context: GraphQLContext
    ) => {
      const comment = await Comment.findById(id);

      if (!comment) {
        throw new GraphQLError("Comment not found", {
          extensions: {
            code: "COMMENT_NOT_FOUND",
          },
        });
      }

      // Check ownership
      requireOwnership(context, comment.author.toString());

      const updatedComment = await Comment.findByIdAndUpdate(
        id,
        { content: input.content },
        { new: true, runValidators: true }
      ).populate(["author", "post"]);

      return updatedComment;
    },

    deleteComment: async (
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ) => {
      const comment = await Comment.findById(id);

      if (!comment) {
        throw new GraphQLError("Comment not found", {
          extensions: {
            code: "COMMENT_NOT_FOUND",
          },
        });
      }

      // Check ownership (or admin can delete any comment)
      const user = requireAuth(context);
      if (
        user._id.toString() !== comment.author.toString() &&
        user.role !== "ADMIN"
      ) {
        // Also allow post author to delete comments on their posts
        const post = await Post.findById(comment.post);
        if (!post || user._id.toString() !== post.author.toString()) {
          throw new GraphQLError(
            "Access denied: You can only delete your own comments",
            {
              extensions: {
                code: "FORBIDDEN",
              },
            }
          );
        }
      }

      await Comment.findByIdAndDelete(id);
      return true;
    },
  },
};
