import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import Illness from '@/models/Illness';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
// Import QuestionBank if needed for cascading deletes or updates of questions
// import QuestionBank from '@/models/QuestionBank';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();
  const session = await getServerSession(req, res, authOptions);
  const { type } = req.query as { type: string };

  if (!session) { // Basic auth check, refine with roles if necessary
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!type) {
    return res.status(400).json({ success: false, message: 'Illness type is required' });
  }
  
  // Normalize type to lowercase as it's stored that way
  const normalizedType = type.toLowerCase();

  switch (req.method) {
    case 'GET':
      try {
        const illness = await Illness.findOne({ type: normalizedType });
        if (!illness) {
          return res.status(404).json({ success: false, message: 'Illness not found' });
        }
        return res.status(200).json({ success: true, data: illness });
      } catch (error) {
        console.error(`Error fetching illness ${normalizedType}:`, error);
        return res.status(500).json({ success: false, message: 'Error fetching illness' });
      }

    case 'PUT':
      try {
        const { name, description } = req.body;
        // Type change is complex (slug), usually not allowed or handled carefully.
        // isSystemDefined should ideally not be updatable via API for system illnesses.
        if (!name) {
          return res.status(400).json({ success: false, message: 'Name is required' });
        }

        const illnessToUpdate = await Illness.findOne({ type: normalizedType });
        if (!illnessToUpdate) {
          return res.status(404).json({ success: false, message: 'Illness not found' });
        }

        // Prevent modification of system-defined illnesses if needed, or certain fields.
        // if (illnessToUpdate.isSystemDefined) {
        //   return res.status(403).json({ success: false, message: 'System-defined illnesses cannot be modified in this way.' });
        // }

        illnessToUpdate.name = name;
        illnessToUpdate.description = description;
        // Add other updatable fields as necessary
        
        await illnessToUpdate.save();
        return res.status(200).json({ success: true, data: illnessToUpdate });
      } catch (error: any) {
        console.error(`Error updating illness ${normalizedType}:`, error);
        if (error.code === 11000) { // Duplicate key error (e.g. if name is made unique and conflicts)
          return res.status(409).json({ success: false, message: `Illness with this ${Object.keys(error.keyValue)[0]} already exists.` });
        }
        return res.status(500).json({ success: false, message: 'Error updating illness' });
      }

    case 'DELETE':
      try {
        const illnessToDelete = await Illness.findOne({ type: normalizedType });
        if (!illnessToDelete) {
          return res.status(404).json({ success: false, message: 'Illness not found' });
        }

        if (illnessToDelete.isSystemDefined) {
          return res.status(403).json({ success: false, message: 'System-defined illnesses cannot be deleted.' });
        }

        await illnessToDelete.deleteOne(); // Replaced remove() with deleteOne()
        
        // Optional: Delete associated questions from QuestionBank
        // await QuestionBank.deleteMany({ type: normalizedType });

        return res.status(200).json({ success: true, message: 'Illness deleted successfully' });
      } catch (error) {
        console.error(`Error deleting illness ${normalizedType}:`, error);
        return res.status(500).json({ success: false, message: 'Error deleting illness' });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }
} 