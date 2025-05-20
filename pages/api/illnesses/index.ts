import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import Illness from '@/models/Illness';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();
  const session = await getServerSession(req, res, authOptions);
  
  // For now, let's assume only authenticated users (officials) can manage illnesses.
  // Add role checks if you have a more granular role system (e.g., session.user.role === 'official')
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  switch (req.method) {
    case 'GET':
      try {
        const illnesses = await Illness.find({}).sort({ name: 1 });
        return res.status(200).json({ success: true, data: illnesses });
    } catch (error) {
      console.error('Error fetching illnesses:', error);
        return res.status(500).json({ success: false, message: 'Error fetching illnesses' });
    }

    case 'POST':
    try {
        const { name, type, description, isSystemDefined } = req.body;
        if (!name || !type) {
          return res.status(400).json({ success: false, message: 'Name and type are required' });
      }
      
        // Basic validation for type (slug-like)
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(type)) {
          return res.status(400).json({ success: false, message: 'Type must be a valid slug (e.g., diabetes, heart-disease)' });
        }

        const newIllness = new Illness({
          name,
        type,
          description,
          isSystemDefined: isSystemDefined || false, // Default to false if not provided
      });
        await newIllness.save();
        return res.status(201).json({ success: true, data: newIllness });
      } catch (error: any) {
      console.error('Error creating illness:', error);
        if (error.code === 11000) { // Duplicate key error
          return res.status(409).json({ success: false, message: `Illness with this ${Object.keys(error.keyValue)[0]} already exists.` });
    }
        return res.status(500).json({ success: false, message: 'Error creating illness' });
  }

    default:
    res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }
} 