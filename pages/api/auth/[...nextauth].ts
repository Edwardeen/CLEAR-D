import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import dbConnect from '../../../lib/dbConnect';
import User, { IUser } from '../../../models/User';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email", placeholder: "jsmith@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing email or password');
        }

        await dbConnect();

        const user = await User.findOne({ email: credentials.email }).select('+password').lean();

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

        console.log('Login successful for:', user.email);
        // Return user object without password
        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      }
    })
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      // Persist the role and id to the token right after signin
      if (user) {
        token.id = user.id;
        token.role = (user as any).role; // Cast needed as default User type lacks role
      }
      return token;
    },
    async session({ session, token }) {
      // Send role and id to the client
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'user' | 'doctor';
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