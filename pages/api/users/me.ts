import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import User, { IUser } from '@/models/User';
// import { getSession } from 'next-auth/react'; // Changed from next-auth/next to next-auth/react for client session
// For server-side session, use:
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]" // Corrected path to authOptions

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // For server-side session usage if preferred:
  const session = await getServerSession(req, res, authOptions)
  // const session = await getSession({ req }); // This was the incorrect method

  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const userId = session.user.id;

  await dbConnect();

  switch (req.method) {
    case 'GET':
      try {
        const user = await User.findById(userId).select('-password'); // Exclude password
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ user });
      } catch (error: any) {
        res.status(500).json({ message: 'Failed to fetch user profile', error: error.message });
      }
      break;

    case 'PUT':
      try {
        const userDataToUpdate: Partial<IUser> = req.body;
        
        // Remove fields that should not be updated directly or are sensitive
        delete userDataToUpdate.email; // Email change should be a separate process
        delete userDataToUpdate.password; // Password change should be a separate process
        delete userDataToUpdate.role; // Role should not be user-editable
        delete userDataToUpdate._id;
        delete (userDataToUpdate as any).createdAt; 
        delete (userDataToUpdate as any).updatedAt;
        delete (userDataToUpdate as any).__v;

        // Handle boolean string conversions from form select if necessary
        if (typeof userDataToUpdate.okuStatus === 'string') {
          userDataToUpdate.okuStatus = userDataToUpdate.okuStatus === 'true';
        }
        if (typeof userDataToUpdate.hasDiabetes === 'string') {
          userDataToUpdate.hasDiabetes = userDataToUpdate.hasDiabetes === 'true';
        }

        // For allergies, if it comes as a string, convert to array (though form now does this client side)
        if (typeof userDataToUpdate.allergies === 'string') {
            userDataToUpdate.allergies = (userDataToUpdate.allergies as string).split(',').map(s => s.trim()).filter(s => s);
        }

        // Simple update for now, no complex array handling for vaccinations/medications
        // The form sends simplified text for these, so we would not update the complex array structure here unless the form is enhanced.

        const updatedUser = await User.findByIdAndUpdate(
          userId,
          { $set: userDataToUpdate }, 
          { new: true, runValidators: true, context: 'query' }
        ).select('-password');

        if (!updatedUser) {
          return res.status(404).json({ message: 'User not found for update' });
        }
        res.status(200).json({ message: 'Profile updated successfully', user: updatedUser });
      } catch (error: any) {
        console.error("Error updating user:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation Error', errors: error.errors });
        }
        res.status(500).json({ message: 'Failed to update user profile', error: error.message });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'PUT']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 