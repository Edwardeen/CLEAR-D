import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import dbConnect from '../../../../lib/dbConnect';
import ServerSetting from '../../../../models/ServerSetting';

// The official superadmin email - normalized to lowercase
const SUPERADMIN_EMAIL = "xxtremeindmc@gmail.com".toLowerCase();

// Helper function to verify superadmin
const isSuperAdminEmail = (email?: string | null): boolean => {
  // Handle undefined/null
  if (!email) return false;
  
  // Skip non-string email values
  if (typeof email !== 'string') {
    console.error(`Invalid email type: ${typeof email}`);
    return false;
  }
  
  // Check if it's a valid-looking email
  if (!email.includes('@')) {
    console.warn(`API Toggle - Email doesn't look like an email address: ${email}`);
    
    // Special case for the known admin user ID
    if (email === '682c8ed653f91f3f3f34f074') {
      console.log("API Toggle - Found admin ID as email, granting access");
      return true;
    }
    
    return false;
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  const result = normalizedEmail === SUPERADMIN_EMAIL;
  console.log(`API Toggle - Checking superadmin email: "${normalizedEmail}" === "${SUPERADMIN_EMAIL}" => ${result}`);
  return result;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  // Log the session details for debugging
  console.log("Server status toggle API - Session check:", {
    hasSession: !!session,
    email: session?.user?.email || 'no-email',
    userId: session?.user?.id || 'no-id'
  });
  
  // Get user email and check if superadmin
  const userEmail = session?.user?.email || '';
  const userId = session?.user?.id || '';
  const isAuthorized = isSuperAdminEmail(userEmail);
  
  // Debug full session in development
  if (process.env.NODE_ENV === 'development') {
    console.log("Full session in server-status-toggle API:", JSON.stringify(session, null, 2));
  }
  
  if (!session || !isAuthorized) {
    console.log(`Forbidden access attempt to server-status-toggle API. Email: ${userEmail}, UserId: ${userId}`);
    return res.status(403).json({ message: 'Forbidden: Access restricted to superadmin.' });
  }

  if (req.method === 'POST') {
    try {
      await dbConnect();
      
      // Find current status or create with a default
      let isServiceGloballyActive = true; // Current server status
      let serverSetting;
      
      try {
        serverSetting = await ServerSetting.findOne({ key: 'global_server_status' });
        if (serverSetting) {
          isServiceGloballyActive = serverSetting.isServiceGloballyActive;
        } else {
          // If not found, create with service off (since we're about to toggle it)
          serverSetting = await ServerSetting.create({ 
            key: 'global_server_status', 
            isServiceGloballyActive: false 
          });
          isServiceGloballyActive = false;
        }
      } catch (dbError) {
        console.error('Error accessing ServerSetting in database:', dbError);
        // In case of database error, try to create the setting directly
        try {
          serverSetting = await ServerSetting.create({ 
            key: 'global_server_status', 
            isServiceGloballyActive: false 
          });
          isServiceGloballyActive = false;
        } catch (createError) {
          console.error('Failed to create ServerSetting record:', createError);
          return res.status(500).json({ 
            message: 'Failed to initialize server status', 
            error: String(createError) 
          });
        }
      }
      
      // Toggle the status
      if (serverSetting) {
        serverSetting.isServiceGloballyActive = !isServiceGloballyActive;
        await serverSetting.save();

        return res.status(200).json({
          message: `Service status toggled to ${serverSetting.isServiceGloballyActive ? 'ON' : 'OFF'}`,
          isServiceGloballyActive: serverSetting.isServiceGloballyActive,
        });
      } else {
        return res.status(500).json({ 
          message: 'Error: ServerSetting object is null after attempts to find or create' 
        });
      }
    } catch (error) {
      console.error('Error toggling server status:', error);
      return res.status(500).json({ 
        message: 'Internal Server Error',
        error: String(error)
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 