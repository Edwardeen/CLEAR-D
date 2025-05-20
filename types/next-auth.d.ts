import { DefaultSession, DefaultUser } from "next-auth"
import { JWT } from "next-auth/jwt"

// Extend the built-in session/user types to include 'id' and 'role'

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's ID */
      id: string;
      /** The user's role. */
      role?: 'user' | 'doctor' | 'official';
      /** The user's photo URL. */
      photoUrl?: string;
    } & DefaultSession["user"];
  }

  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * or the second parameter of the `session` callback, when using a database.
   */
  interface User extends DefaultUser {
    /** The user's role. */
    role?: 'user' | 'doctor' | 'official';
    /** The user's photo URL. */
    photoUrl?: string;
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    /** The user's ID */
    id: string;
    /** The user's role. */
    role?: 'user' | 'doctor' | 'official';
    /** The user's photo URL. */
    photoUrl?: string;
  }
} 