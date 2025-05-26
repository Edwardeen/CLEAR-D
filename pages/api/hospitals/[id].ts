import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import Hospital from '@/models/Hospital';
import mongoose from 'mongoose';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Hospital ID is required' });
  }

  await dbConnect();

  if (req.method === 'GET') {
    try {
      // Validate if the ID is a valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid hospital ID format' });
      }

      const hospital = await Hospital.findById(id);
      
      if (!hospital) {
        return res.status(404).json({ error: 'Hospital not found' });
      }

      console.log('API - Sending hospital data:', JSON.stringify(hospital, null, 2));
      res.status(200).json({ hospital });
    } catch (error: any) {
      console.error('Error fetching hospital:', error);
      res.status(500).json({ error: 'Failed to fetch hospital' });
    }
  } else if (req.method === 'PUT') {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid hospital ID format' });
      }

      const { name, address, phone, email, website, description } = req.body;

      if (!name || !address || !phone) {
        return res.status(400).json({ error: 'Name, address, and phone are required fields' });
      }

      const updatedHospital = await Hospital.findByIdAndUpdate(
        id,
        { name, address, phone, email, website, description },
        { new: true, runValidators: true }
      );

      if (!updatedHospital) {
        return res.status(404).json({ error: 'Hospital not found for update' });
      }

      res.status(200).json({ success: true, data: updatedHospital });
    } catch (error: any) {
      console.error('Error updating hospital:', error);
      if (error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update hospital' });
    }
  } else if (req.method === 'DELETE') {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid hospital ID format' });
      }

      const deletedHospital = await Hospital.findByIdAndDelete(id);

      if (!deletedHospital) {
        return res.status(404).json({ error: 'Hospital not found for deletion' });
      }

      res.status(200).json({ success: true, message: 'Hospital deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting hospital:', error);
      res.status(500).json({ error: 'Failed to delete hospital' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 