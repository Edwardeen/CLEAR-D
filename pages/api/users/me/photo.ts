import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import { getSession } from 'next-auth/react';
import User from '@/models/User';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary - ensure these ENV variables are set for deletion capabilities
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Body parser config is removed, Next.js default JSON parser will be used

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSession({ req });
  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const userId = session.user.id;

  await dbConnect(); 

  if (req.method === 'POST') { // Changed from PUT to POST if it aligns better, or keep as PUT
    try {
      const { photoUrl: newPhotoUrl, photoPublicId: newPhotoPublicId } = req.body;

      if (!newPhotoUrl || !newPhotoPublicId) {
        return res.status(400).json({ message: 'New photoUrl and photoPublicId are required.' });
      }

      // Find the user to get the old photoPublicId for cleanup
      const user = await User.findById(userId).select('photoUrl photoPublicId').exec(); // Lean might be an issue if we save later, but findByIdAndUpdate is better
      if (!user) {
        // This case should ideally not happen if session is valid
        return res.status(404).json({ message: 'User not found.' });
      }
      const oldPhotoPublicId = user.photoPublicId;
      // const oldPhotoUrl = user.photoUrl; // For logging or comparison if needed

      // Update user document with the new photo URL and Public ID
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: { photoUrl: newPhotoUrl, photoPublicId: newPhotoPublicId } },
        { new: true } // Return the updated document
      );

      if (!updatedUser) {
        // Should not happen if user was found earlier
        return res.status(404).json({ message: "User found but update failed." });
      }

      // Cleanup old photo from Cloudinary if it exists and is different
      if (oldPhotoPublicId && oldPhotoPublicId !== newPhotoPublicId) {
        console.log(`Attempting to delete old Cloudinary photo: ${oldPhotoPublicId}`);
        try {
          const deletionResult = await cloudinary.uploader.destroy(oldPhotoPublicId);
          console.log('Old Cloudinary photo deletion result:', deletionResult);
          if (deletionResult.result !== 'ok' && deletionResult.result !== 'not found'){
            // Log a warning if deletion wasn't successful but proceed with the update
            console.warn(`Cloudinary deletion of ${oldPhotoPublicId} was not definitively 'ok' or 'not found'. Result: ${deletionResult.result}`);
          }
        } catch (destroyErr: any) {
          console.error(`Error deleting old Cloudinary photo ${oldPhotoPublicId}:`, destroyErr);
          // Non-fatal for the success of the photo update itself, but should be logged.
        }
      } else if (oldPhotoPublicId && oldPhotoPublicId === newPhotoPublicId) {
        console.log("New photo has the same public_id as old. No deletion needed.");
      }

      res.status(200).json({ 
        message: 'Photo updated successfully', 
        photoUrl: updatedUser.photoUrl, 
        photoPublicId: updatedUser.photoPublicId 
      });
    
    } catch (error: any) {
      console.error('Error updating user photo:', error);
      res.status(500).json({ message: 'Internal Server Error updating profile photo', error: error.message });
    }

  } else {
    res.setHeader('Allow', ['POST']); // Or PUT, depending on your preference
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 