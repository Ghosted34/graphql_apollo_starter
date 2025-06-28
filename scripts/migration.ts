import mongoose from "mongoose";
import { User } from "../src/models/User";
import { Post } from "../src/models/Post";
import connectDB from "../src/config/db";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface Migration {
  version: string;
  description: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

// Migration tracking schema
const migrationSchema = new mongoose.Schema({
  version: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  appliedAt: { type: Date, default: Date.now },
});

const Migration = mongoose.model("Migration", migrationSchema);

const migrations: Migration[] = [
  {
    version: "001",
    description: "Add user roles and email verification",
    up: async () => {
      console.log("📝 Adding role field to users...");

      // Add role field to existing users (default to USER)
      await User.updateMany(
        { role: { $exists: false } },
        { $set: { role: "USER" } }
      );

      // Add isEmailVerified field
      await User.updateMany(
        { isEmailVerified: { $exists: false } },
        { $set: { isEmailVerified: false } }
      );

      console.log("✅ User roles and email verification added");
    },
    down: async () => {
      console.log("📝 Removing role and email verification fields...");

      await User.updateMany(
        {},
        {
          $unset: {
            role: "",
            isEmailVerified: "",
          },
        }
      );

      console.log("✅ Fields removed");
    },
  },

  {
    version: "002",
    description: "Add post tags and published status",
    up: async () => {
      console.log("📝 Adding tags and published status to posts...");

      // Add tags array to existing posts
      await Post.updateMany(
        { tags: { $exists: false } },
        { $set: { tags: [] } }
      );

      // Add published status (default to false)
      await Post.updateMany(
        { published: { $exists: false } },
        { $set: { published: false } }
      );

      console.log("✅ Post tags and published status added");
    },
    down: async () => {
      console.log("📝 Removing tags and published fields...");

      await Post.updateMany(
        {},
        {
          $unset: {
            tags: "",
            published: "",
          },
        }
      );

      console.log("✅ Fields removed");
    },
  },

  {
    version: "003",
    description: "Add refresh tokens to users",
    up: async () => {
      console.log("📝 Adding refresh tokens array to users...");

      await User.updateMany(
        { refreshTokens: { $exists: false } },
        { $set: { refreshTokens: [] } }
      );

      console.log("✅ Refresh tokens field added");
    },
    down: async () => {
      console.log("📝 Removing refresh tokens field...");

      await User.updateMany({}, { $unset: { refreshTokens: "" } });

      console.log("✅ Refresh tokens field removed");
    },
  },

  {
    version: "004",
    description: "Create database indexes for performance",
    up: async () => {
      console.log("📝 Creating database indexes...");

      // User indexes
      await User.collection.createIndex({ email: 1 }, { unique: true });
      await User.collection.createIndex({ username: 1 }, { unique: true });

      // Post indexes
      await Post.collection.createIndex({ author: 1, published: 1 });
      await Post.collection.createIndex({ tags: 1 });
      await Post.collection.createIndex({ createdAt: -1 });

      // Text search index
      await Post.collection.createIndex(
        { title: "text", content: "text" },
        { weights: { title: 10, content: 5 } }
      );

      console.log("✅ Database indexes created");
    },
    down: async () => {
      console.log("📝 Dropping custom indexes...");

      try {
        await Post.collection.dropIndex("author_1_published_1");
        await Post.collection.dropIndex("tags_1");
        await Post.collection.dropIndex("createdAt_-1");
        await Post.collection.dropIndex("title_text_content_text");
      } catch (error) {
        console.log("Some indexes may not exist, skipping...");
      }

      console.log("✅ Custom indexes dropped");
    },
  },
];

async function getAppliedMigrations(): Promise<string[]> {
  const applied = await Migration.find({}).sort({ version: 1 });
  return applied.map((m) => m.version);
}

async function markMigrationApplied(migration: Migration): Promise<void> {
  await new Migration({
    version: migration.version,
    description: migration.description,
  }).save();
}

async function markMigrationReverted(version: string): Promise<void> {
  await Migration.deleteOne({ version });
}

async function runMigrations(
  direction: "up" | "down" = "up",
  targetVersion?: string
) {
  try {
    console.log(`🚀 Running migrations ${direction}...`);

    await connectDB();

    const appliedMigrations = await getAppliedMigrations();

    if (direction === "up") {
      // Run pending migrations
      for (const migration of migrations) {
        if (!appliedMigrations.includes(migration.version)) {
          if (targetVersion && migration.version > targetVersion) {
            break;
          }

          console.log(
            `\n⬆️  Running migration ${migration.version}: ${migration.description}`
          );
          await migration.up();
          await markMigrationApplied(migration);
          console.log(`✅ Migration ${migration.version} completed`);
        }
      }
    } else {
      // Run rollbacks
      const migrationsToRollback = migrations
        .filter((m) => appliedMigrations.includes(m.version))
        .reverse();

      for (const migration of migrationsToRollback) {
        if (targetVersion && migration.version <= targetVersion) {
          break;
        }

        console.log(
          `\n⬇️  Rolling back migration ${migration.version}: ${migration.description}`
        );
        await migration.down();
        await markMigrationReverted(migration.version);
        console.log(`✅ Migration ${migration.version} rolled back`);
      }
    }

    console.log("\n🎉 Migration process completed!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

async function showMigrationStatus() {
  try {
    await connectDB();

    const appliedMigrations = await getAppliedMigrations();

    console.log("\n📊 Migration Status:");
    console.log("===================");

    for (const migration of migrations) {
      const status = appliedMigrations.includes(migration.version)
        ? "✅ Applied"
        : "⏳ Pending";
      console.log(`${migration.version}: ${migration.description} - ${status}`);
    }

    console.log(`\nTotal migrations: ${migrations.length}`);
    console.log(`Applied: ${appliedMigrations.length}`);
    console.log(`Pending: ${migrations.length - appliedMigrations.length}`);
  } catch (error) {
    console.error("❌ Failed to get migration status:", error);
  } finally {
    await mongoose.connection.close();
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const target = args[1];

  switch (command) {
    case "up":
      await runMigrations("up", target);
      break;
    case "down":
      await runMigrations("down", target);
      break;
    case "status":
      await showMigrationStatus();
      break;
    default:
      console.log("Usage:");
      console.log(
        "  npm run migrate up [version]     - Run migrations up to version"
      );
      console.log(
        "  npm run migrate down [version]   - Rollback migrations down to version"
      );
      console.log("  npm run migrate status           - Show migration status");
      break;
  }
}

if (require.main === module) {
  main();
}

export { runMigrations, showMigrationStatus };
