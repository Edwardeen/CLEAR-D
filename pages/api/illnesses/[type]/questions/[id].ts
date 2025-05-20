import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import dbConnect from '@/lib/dbConnect';
import QuestionBank from '@/models/QuestionBank';
import mongoose from 'mongoose';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  
  // This endpoint is restricted to officials (role: doctor)
  if (!session || session.user?.role !== 'doctor') {
    return res.status(401).json({ message: 'Unauthorized. Only healthcare officials can manage illness questions.' });
  }

  await dbConnect();
  
  // Get the illness type and question ID from the URL
  const { type, id } = req.query;
  
  if (!type || typeof type !== 'string' || !id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Invalid parameters' });
  }

  // For querying by ID, handle both ObjectID and questionId formats
  const findQuery = mongoose.isValidObjectId(id) 
    ? { _id: id, type } 
    : { questionId: id, type };

  // Handle different HTTP methods
  if (req.method === 'GET') {
    try {
      // Fetch the specific question
      const question = await QuestionBank.findOne(findQuery).lean();
      
      if (!question) {
        return res.status(404).json({ message: `Question not found` });
      }
      
      return res.status(200).json({ question });
    } catch (error) {
      console.error(`Error fetching question:`, error);
      return res.status(500).json({ message: `Error fetching question`, error: String(error) });
    }
  } 
  else if (req.method === 'PUT') {
    try {
      // Update the question
      const { questionId, text, weight, autoPopulate, autoPopulateFrom } = req.body;
      
      if (!questionId || !text || weight === undefined) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Check if changing questionId, ensure it doesn't conflict with existing questions
      if (questionId !== id && !mongoose.isValidObjectId(id)) {
        const existingQuestion = await QuestionBank.findOne({ 
          questionId, 
          type,
          _id: { $ne: mongoose.isValidObjectId(id) ? id : undefined }
        });
        
        if (existingQuestion) {
          return res.status(409).json({ message: `Question ID ${questionId} already exists for ${type}` });
        }
      }
      
      // Find and update the question
      const updatedQuestion = await QuestionBank.findOneAndUpdate(
        findQuery,
        {
          questionId,
          text,
          weight,
          autoPopulate: autoPopulate || false,
          autoPopulateFrom: autoPopulateFrom || undefined
        },
        { new: true, runValidators: true }
      );
      
      if (!updatedQuestion) {
        return res.status(404).json({ message: `Question not found` });
      }
      
      return res.status(200).json({ message: 'Question updated successfully', question: updatedQuestion });
    } catch (error) {
      console.error(`Error updating question:`, error);
      return res.status(500).json({ message: `Error updating question`, error: String(error) });
    }
  }
  else if (req.method === 'DELETE') {
    try {
      // Delete the question
      const deletedQuestion = await QuestionBank.findOneAndDelete(findQuery);
      
      if (!deletedQuestion) {
        return res.status(404).json({ message: `Question not found` });
      }
      
      return res.status(200).json({ message: 'Question deleted successfully' });
    } catch (error) {
      console.error(`Error deleting question:`, error);
      return res.status(500).json({ message: `Error deleting question`, error: String(error) });
    }
  }
  else {
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 