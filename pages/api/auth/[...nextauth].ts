import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import dbConnect from '../../../lib/dbConnect';
import User, { IUser } from '../../../models/User';

// // FOR DEBUGGING -- REMOVE AFTER TESTING
// console.log('[NextAuth Init] Attempting to read TEST_ENV_VAR:', process.env.TEST_ENV_VAR);
// console.log('[NextAuth Init] NEXTAUTH_SECRET as seen by server:', process.env.NEXTAUTH_SECRET ? process.env.NEXTAUTH_SECRET.substring(0, 5) + '...[TRUNCATED]' : 'NOT SET');
// // END DEBUGGING

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email", placeholder: "jsmith@example.com" },
        password: { label: "Password", type: "password" },
        expectedRole: { label: "Expected Role", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing email or password');
        }

        await dbConnect();

        const user = await User.findOne({ email: credentials.email }).select('+password photoUrl name role').lean();

        if (!user) {
          console.log('No user found with email:', credentials.email);
          throw new Error('No user found with this email.');
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password! // Non-null assertion because we selected it
        );

        if (!isPasswordValid) {
          console.log('Invalid password for user:', credentials.email);
          throw new Error('Invalid password.');
        }

        // Check if the user's role is valid for the session
        if (user.role !== 'user' && user.role !== 'doctor') {
          console.log(`User ${user.email} has an invalid role for session: ${user.role}`);
          throw new Error('User role is not permitted for login.');
        }
        
        if (credentials.expectedRole && user.role !== credentials.expectedRole) {
          console.log(`Role mismatch for ${user.email}. Expected ${credentials.expectedRole}, got ${user.role}`);
          throw new Error(`Access Denied: Account does not have the required role (${credentials.expectedRole}).`);
        }

        console.log('Login successful for:', user.email, 'with role:', user.role);
        // Return user object without password
        
        let fullName: string | undefined = undefined;
        if (user.name) {
          if (user.name.first && user.name.last) {
            fullName = `${user.name.first} ${user.name.last}`;
          } else if (user.name.first) {
            fullName = user.name.first;
          } else if (user.name.last) {
            fullName = user.name.last;
          }
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: fullName,
          role: user.role as 'user' | 'doctor',
          photoUrl: user.photoUrl,
        };
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      // `user` here is the object from `authorize` or OAuth profile
      if (user) { // This block runs only on sign-in
        token.id = user.id;
        token.role = (user as any).role; // `user.role` from authorize should be correctly typed now
        token.photoUrl = (user as any).photoUrl;
        // Standard claims like `name`, `email`, `picture` (for user.image) might be automatically handled by NextAuth if present on `user`
        // If `user.name` is defined, it usually populates `token.name`
        // If `user.email` is defined, it usually populates `token.email`
        // If `user.photoUrl` is to be used as `session.user.image`, ensure `token.picture` or similar standard claim is set, or handle in session callback.
        // For consistency, we are using token.photoUrl and will map it in the session callback.
      }
      return token;
    },
    async session({ session, token }) {
      // `token` here has `id`, `role`, `photoUrl` from the jwt callback
      if (session.user) {
        session.user.id = token.id as string; 
        session.user.role = token.role as 'user' | 'doctor'; 
        session.user.photoUrl = token.photoUrl as string | undefined;
        session.user.image = token.photoUrl as string | undefined; // Populate standard `image` field from our `photoUrl`
      }
      return session;
    }
  },
  pages: {
    signIn: '/login', // Redirect users to /login page
    // error: '/auth/error', // Optional: Custom error page
    // newUser: '/register' // Optional: Redirect new users here after sign up (doesn't work with Credentials provider)
  },
  secret: process.env.NEXTAUTH_SECRET, // Ensure this is set in .env.local
  debug: process.env.NODE_ENV === 'development', // Enable debug messages in development
};

export default NextAuth(authOptions); 