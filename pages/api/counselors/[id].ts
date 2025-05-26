import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import Counselor from '@/models/Counselor';
import Hospital from '@/models/Hospital'; // Import Hospital model for fetching name
import mongoose from 'mongoose';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Valid Counselor ID is required' });
  }

  await dbConnect();

  switch (req.method) {
    case 'GET':
      try {
        const counselor = await Counselor.findById(id);
        if (!counselor) {
          return res.status(404).json({ error: 'Counselor not found' });
        }
        res.status(200).json({ success: true, data: counselor });
      } catch (error: any) {
        console.error('Error fetching counselor:', error);
        res.status(500).json({ error: 'Failed to fetch counselor' });
      }
      break;

    case 'PUT':
      try {
        const { name, specialization, phone, email, hospitalId, description } = req.body;

        if (!name || !specialization) {
          return res.status(400).json({ error: 'Name and specialization are required fields' });
        }

        let hospitalName = req.body.hospital; // Keep existing name if hospitalId doesn't change or isn't provided for update

        // If hospitalId is provided and is a valid ObjectId, try to fetch the hospital name
        if (hospitalId && mongoose.Types.ObjectId.isValid(hospitalId)) {
            const hospital = await Hospital.findById(hospitalId).select('name').lean();
            if (hospital) {
                hospitalName = hospital.name;
            } else {
                // Optionally handle if hospitalId is given but not found,
                // e.g., clear hospitalName or return an error.
                // For now, we'll proceed with potentially outdated hospitalName if new ID is invalid.
                 console.warn(`Hospital with ID ${hospitalId} not found when updating counselor.`);
            }
        } else if (hospitalId === '' || hospitalId === null) { // If hospitalId is explicitly cleared
            hospitalName = ''; // Clear hospital name as well
        }


        const updatedCounselor = await Counselor.findByIdAndUpdate(
          id,
          { 
            name, 
            specialization, 
            phone, 
            email, 
            hospital: hospitalName, // Updated hospital name
            hospitalId: hospitalId || null, // Ensure hospitalId is null if empty string
            description 
          },
          { new: true, runValidators: true }
        );

        if (!updatedCounselor) {
          return res.status(404).json({ error: 'Counselor not found for update' });
        }
        res.status(200).json({ success: true, data: updatedCounselor });
      } catch (error: any) {
        console.error('Error updating counselor:', error);
        if (error.name === 'ValidationError') {
          return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to update counselor' });
      }
      break;

    case 'DELETE':
      try {
        const deletedCounselor = await Counselor.findByIdAndDelete(id);
        if (!deletedCounselor) {
          return res.status(404).json({ error: 'Counselor not found for deletion' });
        }
        res.status(200).json({ success: true, message: 'Counselor deleted successfully' });
      } catch (error: any) {
        console.error('Error deleting counselor:', error);
        res.status(500).json({ error: 'Failed to delete counselor' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
      break;
  }
} 