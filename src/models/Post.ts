import mongoose, { Schema } from "mongoose";
import { IPost } from "../types";

const postSchema = new Schema<IPost>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    content: {
      type: String,
      required: [true, "Content is required"],
      maxlength: [10000, "Content cannot exceed 10000 characters"],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    published: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for better query performance
postSchema.index({ author: 1 });
postSchema.index({ published: 1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ tags: 1 });

// Text index for search functionality
postSchema.index({
  title: "text",
  content: "text",
  tags: "text",
});

export const Post = mongoose.model<IPost>("Post", postSchema);
