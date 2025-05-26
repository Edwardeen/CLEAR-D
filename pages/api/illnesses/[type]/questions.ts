import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import dbConnect from '@/lib/dbConnect';
import QuestionBank, { IQuestionBankItem } from '@/models/QuestionBank';

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
  
  // Get the illness type from the URL
  const { type } = req.query;
  
  if (!type || typeof type !== 'string') {
    return res.status(400).json({ message: 'Invalid illness type' });
  }

  // Handle different HTTP methods
  if (req.method === 'GET') {
    try {
      // Fetch all questions for this illness type
      const questions = await QuestionBank.find({ type }).sort({ questionId: 1 }).lean();
      return res.status(200).json({ questions });
    } catch (error) {
      console.error(`Error fetching questions for ${type}:`, error);
      return res.status(500).json({ message: `Error fetching questions for ${type}`, error: String(error) });
    }
  } 
  else if (req.method === 'POST') {
    try {
      // Add a new question
      const { questionId, text, weight, autoPopulate, autoPopulateFrom } = req.body;
      
      if (!questionId || !text || weight === undefined) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Check for duplicate questionId
      const existingQuestion = await QuestionBank.findOne({ 
        questionId, 
        type 
      });
      
      if (existingQuestion) {
        return res.status(409).json({ message: `Question ID ${questionId} already exists for ${type}` });
      }
      
      // Create the new question
      const newQuestion = new QuestionBank({
        type,
        questionId,
        text,
        weight,
        autoPopulate: autoPopulate || false,
        autoPopulateFrom: autoPopulateFrom || undefined
      });
      
      await newQuestion.save();
      return res.status(201).json({ message: 'Question created successfully', question: newQuestion });
    } catch (error) {
      console.error(`Error creating question for ${type}:`, error);
      return res.status(500).json({ message: `Error creating question for ${type}`, error: String(error) });
    }
  }
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 