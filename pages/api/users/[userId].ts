import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import User, { IUser } from '../../../models/User'; // Corrected path
import dbConnect from '../../../lib/dbConnect';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const {
    query: { userId },
    method,
  } = req;

  const session = await getSession({ req });

  if (!session || session.user?.role !== 'doctor') {
    return res.status(403).json({ message: 'Access Denied: You do not have permission to view this information.' });
  }

  await dbConnect();

  switch (method) {
    case 'GET':
      try {
        // Exclude password from the returned user object
        const user: IUser | null = await User.findById(userId).select('-password');
        
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        // Ensure all potentially sensitive fields that are not password but still should not be sent are handled here if any.
        // For now, only password is explicitly excluded.
        
        res.status(200).json({ success: true, data: user });
      } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ success: false, message: 'Server error fetching user details' });
      }
      break;
    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).json({ success: false, message: `Method ${method} Not Allowed` });
      break;
  }
} 