import { IUser, UserRole } from "../types";
import { User } from "../models/User";
import { UserInputError, ForbiddenError } from "apollo-server-express";

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  username?: string;
  bio?: string;
  avatar?: string;
}

export interface UserFilters {
  search?: string;
  role?: string;
  isEmailVerified?: boolean;
  accountLocked?: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedUsers {
  users: IUser[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

class UserService {
  // Get user by ID
  async getUserById(userId: string): Promise<IUser | null> {
    const user = await User.findById(userId);
    return user;
  }

  // Get user by username
  async getUserByUsername(username: string): Promise<IUser | null> {
    const user = await User.findOne({ username });
    return user;
  }

  // Get user by email
  async getUserByEmail(email: string): Promise<IUser | null> {
    const user = await User.findOne({ email });
    return user;
  }

  // Update user profile
  async updateProfile(
    userId: string,
    input: UpdateProfileInput
  ): Promise<IUser> {
    const { firstName, lastName, username, bio, avatar } = input;

    // Check if username is taken (if provided)
    if (username) {
      const existingUser = await User.findOne({
        username,
        _id: { $ne: userId },
      });

      if (existingUser) {
        throw new UserInputError("Username already taken");
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (username !== undefined) updateData.username = username;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar !== undefined) updateData.avatar = avatar;

    const user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      throw new UserInputError("User not found");
    }

    return user;
  }

  // Get users with pagination and filtering
  async getUsers(
    filters: UserFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedUsers> {
    const { search, role, isEmailVerified, accountLocked } = filters;

    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = pagination;

    // Build filter query
    const query: any = {};

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (role) {
      query.role = role;
    }

    if (isEmailVerified !== undefined) {
      query.isEmailVerified = isEmailVerified;
    }

    if (accountLocked !== undefined) {
      query.accountLocked = accountLocked;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === "asc" ? 1 : -1;

    // Execute queries
    const [users, totalCount] = await Promise.all([
      User.find(query)
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      users: users as IUser[],
      totalCount,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  // Admin: Update user role
  async updateUserRole(
    adminUserId: string,
    targetUserId: string,
    newRole: string
  ): Promise<IUser> {
    // Verify admin permissions
    const adminUser = await User.findById(adminUserId);
    if (!adminUser || adminUser.role !== UserRole.ADMIN) {
      throw new ForbiddenError("Only admins can update user roles");
    }

    // Validate role
    const validRoles = ["user", "admin", "moderator"];
    if (!validRoles.includes(newRole)) {
      throw new UserInputError("Invalid role specified");
    }

    // Prevent self-demotion
    if (adminUserId === targetUserId && newRole !== "admin") {
      throw new UserInputError("Cannot demote yourself");
    }

    const user = await User.findByIdAndUpdate(
      targetUserId,
      { role: newRole, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new UserInputError("User not found");
    }

    return user;
  }

  // Admin: Lock/unlock user account
  //   async toggleAccountLock(
  //     adminUserId: string,
  //     targetUserId: string
  //   ): Promise<IUser> {
  //     // Verify admin permissions
  //     const adminUser = await User.findById(adminUserId);
  //     if (!adminUser || adminUser.role !== UserRole.ADMIN) {
  //       throw new ForbiddenError("Only admins can lock/unlock accounts");
  //     }

  //     // Prevent self-locking
  //     if (adminUserId === targetUserId) {
  //       throw new UserInputError("Cannot lock your own account");
  //     }

  //     const targetUser = await User.findById(targetUserId);
  //     if (!targetUser) {
  //       throw new UserInputError("User not found");
  //     }

  //     const isCurrentlyLocked = targetUser.accountLocked;
  //     const updateData: any = {
  //       accountLocked: !isCurrentlyLocked,
  //       updatedAt: new Date(),
  //     };

  //     // If unlocking, clear lock-related fields
  //     if (isCurrentlyLocked) {
  //       updateData.$unset = {
  //         lockUntil: 1,
  //         loginAttempts: 1,
  //       };
  //     }

  //     const user = await User.findByIdAndUpdate(targetUserId, updateData, {
  //       new: true,
  //       runValidators: true,
  //     });

  //     return user!;
  //   }

  // Admin: Delete user account
  async deleteUser(
    adminUserId: string,
    targetUserId: string
  ): Promise<boolean> {
    // Verify admin permissions
    const adminUser = await User.findById(adminUserId);
    if (!adminUser || adminUser.role !== UserRole.ADMIN) {
      throw new ForbiddenError("Only admins can delete users");
    }

    // Prevent self-deletion
    if (adminUserId === targetUserId) {
      throw new UserInputError("Cannot delete your own account");
    }

    const deletedUser = await User.findByIdAndDelete(targetUserId);
    if (!deletedUser) {
      throw new UserInputError("User not found");
    }

    return true;
  }

  // Get user statistics
  async getUserStats(): Promise<{
    totalUsers: number;
    verifiedUsers: number;
    unverifiedUsers: number;
    lockedUsers: number;
    adminUsers: number;
    recentUsers: number;
  }> {
    const [totalUsers, verifiedUsers, lockedUsers, adminUsers, recentUsers] =
      await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ isEmailVerified: true }),
        User.countDocuments({ accountLocked: true }),
        User.countDocuments({ role: "admin" }),
        User.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        }),
      ]);

    return {
      totalUsers,
      verifiedUsers,
      unverifiedUsers: totalUsers - verifiedUsers,
      lockedUsers,
      adminUsers,
      recentUsers,
    };
  }

  // Search users by various criteria
  async searchUsers(searchTerm: string, limit: number = 10): Promise<IUser[]> {
    if (!searchTerm || searchTerm.trim().length < 2) {
      return [];
    }

    const users = await User.find({
      $or: [
        { firstName: { $regex: searchTerm, $options: "i" } },
        { lastName: { $regex: searchTerm, $options: "i" } },
        { username: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } },
      ],
      accountLocked: { $ne: true },
    })
      .limit(limit)
      .select(
        "-password -refreshToken -emailVerificationToken -passwordResetToken"
      )
      .lean();

    return users as IUser[];
  }

  // Get user activity summary
  //   async getUserActivity(userId: string): Promise<{
  //     lastLogin?: Date;
  //     loginCount: number;
  //     accountAge: number;
  //     isActive: boolean;
  //   }> {
  //     const user = await User.findById(userId);
  //     if (!user) {
  //       throw new UserInputError("User not found");
  //     }

  //     const accountAge = Math.floor(
  //       (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  //     );

  //     const isActive =
  //       user.lastLogin &&
  //       Date.now() - user.lastLogin.getTime() < 30 * 24 * 60 * 60 * 1000; // Active within 30 days

  //     return {
  //       lastLogin: user.lastLogin,
  //       loginCount: user.loginCount || 0,
  //       accountAge,
  //       isActive: Boolean(isActive),
  //     };
  //   }

  // Update user avatar
  async updateAvatar(userId: string, avatarUrl: string): Promise<IUser> {
    const user = await User.findByIdAndUpdate(
      userId,
      {
        avatar: avatarUrl,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new UserInputError("User not found");
    }

    return user;
  }

  // Deactivate user account (soft delete)
  async deactivateAccount(userId: string): Promise<boolean> {
    await User.findByIdAndUpdate(userId, {
      accountLocked: true,
      $unset: { refreshToken: 1 },
      updatedAt: new Date(),
    });

    return true;
  }
}

export const userService = new UserService();
