import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { db, mongoClient } from "@/lib/mongodb";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const facebookClientId = process.env.FACEBOOK_CLIENT_ID;
const facebookClientSecret = process.env.FACEBOOK_CLIENT_SECRET;
const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  emailVerification: {
    // Development placeholder: print the one-time verification link to the
    // server console so email/password accounts can become `emailVerified`.
    // Replace with a real mail provider before deploying to production.
    sendVerificationEmail: async ({ user, url }) => {
      if (process.env.NODE_ENV === "production") {
        console.warn(
          "[auth] sendVerificationEmail is not configured; no verification email was sent.",
        );
        return;
      }

      console.info(`[auth] Verify ${user.email}: ${url}`);
    },
    sendOnSignUp: true,
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "facebook"],
    },
  },
  user: {
    additionalFields: {
      // `input: false` means public sign-up requests cannot set these fields.
      // Existing users without a role are treated as customers in the DAL.
      role: {
        type: "string",
        required: false,
        defaultValue: "customer",
        input: false,
      },
      phone: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  socialProviders: {
    ...(googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {}),
    ...(facebookClientId && facebookClientSecret
      ? {
          facebook: {
            clientId: facebookClientId,
            clientSecret: facebookClientSecret,
          },
        }
      : {}),
    ...(githubClientId && githubClientSecret
      ? {
          github: {
            clientId: githubClientId,
            clientSecret: githubClientSecret,
          },
        }
      : {}),
  },
  database: mongodbAdapter(db, {
    client: mongoClient,
    transaction: true,
  }),
});
