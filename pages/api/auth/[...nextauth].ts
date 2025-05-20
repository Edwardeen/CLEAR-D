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

        // Log what we're returning to ensure email is correct
        const authResult = {
          id: user._id.toString(),
          email: user.email,
          name: fullName,
          role: user.role as 'user' | 'doctor',
          photoUrl: user.photoUrl,
        };
        
        console.log('Auth result being returned:', JSON.stringify(authResult));
        return authResult;
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 1 day - how frequently to update the token
  },
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      // Always log token details for debugging
      console.log("JWT Callback Triggered:", { 
        trigger, 
        hasUser: !!user,
        hasAccount: !!account,
        tokenBefore: {
          email: token.email,
          hasEmail: !!token.email,
          id: token.id,
          sub: token.sub
        }
      });

      // `user` here is the object from `authorize` or OAuth profile
      if (user) { // This block runs only on sign-in
        console.log("JWT Callback: Adding user data to token", { 
          userEmail: user.email,
          userId: user.id,
          userObj: JSON.stringify(user)
        });
        
        // Assign user properties to token
        token.id = user.id;
        
        // Explicitly set email on token - make sure it's actually an email
        if (user.email && user.email.includes('@')) {
          token.email = user.email;
        } else {
          console.warn("JWT Callback: User email doesn't look like an email address!", user.email);
          
          // Check if there are any claims in the token that look like an email
          const possibleEmails = Object.entries(user)
            .filter(([key, value]) => 
              typeof value === 'string' && value.includes('@')
            )
            .map(([_, value]) => value as string);
          
          if (possibleEmails.length > 0) {
            console.log("JWT Callback: Found possible email in user object:", possibleEmails[0]);
            token.email = possibleEmails[0];
          } else if (token.email && token.email.includes('@')) {
            console.log("JWT Callback: Keeping existing token email");
            // Keep existing token.email
          } else {
            console.error("JWT Callback: No valid email found in user or token!");
          }
        }
        
        token.name = user.name;
        token.role = (user as any).role;
        token.photoUrl = (user as any).photoUrl;
        
        // Debug token creation on sign-in
        console.log("JWT Callback: Token after adding user data", {
          email: token.email,
          hasEmail: !!token.email,
          tokenName: token.name,
          tokenId: token.id,
          userId: user.id
        });
      }
      
      // CRITICAL: If the token has the user ID as the email (common issue), fix it
      if (token.email && token.id && token.email === token.id) {
        console.warn("JWT Callback: Email appears to be the user ID, attempting to fix");
        
        // Look for other sources of email in the token
        if (token.sub && token.sub.includes('@')) {
          token.email = token.sub;
          console.log("JWT Callback: Fixed email using token.sub:", token.sub);
        } else if (token.name && token.name.includes('@')) {
          token.email = token.name;
          console.log("JWT Callback: Fixed email using token.name:", token.name);
        } else {
          // Last resort - use hardcoded admin email if it's a known admin ID
          if (token.id === '682c8ed653f91f3f3f34f074') {
            token.email = 'xxtremeindmc@gmail.com';
            console.log("JWT Callback: Set admin email based on known ID");
          } else {
            console.error("JWT Callback: Unable to fix corrupted email!");
          }
        }
      }
      
      // Ensure email is always in token (defensive coding)
      if (!token.email && token.sub) {
        console.log("JWT Callback: Fallback - using sub as email", { sub: token.sub });
        token.email = token.sub;
      }
      
      return token;
    },
    async session({ session, token }) {
      console.log("Session Callback: Token received", {
        tokenEmail: token.email,
        tokenId: token.id,
        tokenName: token.name,
        hasTokenEmail: !!token.email
      });

      // `token` here has `id`, `role`, `photoUrl` from the jwt callback
      if (session.user) {
        // Explicitly copy all important fields from token to session
        session.user.id = token.id as string;
        
        // Validate email again here
        if (token.email && typeof token.email === 'string' && token.email.includes('@')) {
          session.user.email = token.email;
        } else if (token.id === '682c8ed653f91f3f3f34f074') {
          // Special case for admin
          session.user.email = 'xxtremeindmc@gmail.com';
          console.log("Session Callback: Set admin email based on known ID");
        } else {
          // Attempt to preserve any existing valid email in session
          if (!session.user.email || !session.user.email.includes('@')) {
            console.error("Session Callback: No valid email in token or session!");
            
            // Last resort, use a placeholder with the user ID
            session.user.email = `user-${token.id}@placeholder.com`;
            console.log("Session Callback: Using placeholder email:", session.user.email);
          }
        }
        
        session.user.name = token.name as string;
        session.user.role = token.role as 'user' | 'doctor'; 
        session.user.photoUrl = token.photoUrl as string | undefined;
        session.user.image = token.photoUrl as string | undefined;
        
        // Debug session creation
        console.log("Session Callback: Session after update", {
          sessionEmail: session.user.email,
          sessionId: session.user.id,
          sessionName: session.user.name,
          hasSessionEmail: !!session.user.email,
          isEmailValid: session.user.email?.includes('@') || false
        });
      }
      return session;
    }
  },
  jwt: {
    // Use more secure settings for production
    maxAge: 60 * 60 * 24 * 30, // 30 days
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