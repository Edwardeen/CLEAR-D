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

      res.status(200).json({ hospital });
    } catch (error: any) {
      console.error('Error fetching hospital:', error);
      res.status(500).json({ error: 'Failed to fetch hospital' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 