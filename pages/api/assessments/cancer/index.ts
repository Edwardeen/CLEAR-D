import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import dbConnect from '@/lib/dbConnect';
import Assessment from '@/models/Assessment';
import QuestionBank from '@/models/QuestionBank';
import User from '@/models/User';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  
  // Auth check
  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const userId = session.user.id;

  await dbConnect();

  if (req.method === 'POST') {
    const { responses: manualResponsesFromClient } = req.body;
    
    if (!manualResponsesFromClient || !Array.isArray(manualResponsesFromClient)) {
      return res.status(400).json({ message: 'Invalid responses format.' });
    }

    try {
      // Get user data for auto-populated questions
      const user = await User.findById(userId).select('hasDiabetes gender').lean();
      
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }
      
      // Process user data
      const hasDiabetes = user.hasDiabetes === true;
      
      // Get all cancer questions from DB
      const allQuestions = await QuestionBank.find({ type: 'cancer' }).lean();
      const questionMap = new Map();
      allQuestions.forEach(q => questionMap.set(q.questionId, q));
      
      let totalScore = 0;
      const processedResponses = [];
      
      // Process automatic questions (diabetes)
      const diabetesQuestion = questionMap.get('C5');
      if (diabetesQuestion) {
        const answer = hasDiabetes ? 'Yes' : 'No';
        const score = hasDiabetes ? diabetesQuestion.weight : 0;
        totalScore += score;
        processedResponses.push({
          questionId: 'C5',
          answer,
          score,
          autoPopulated: true
        });
      }
      
      // Process manual responses
      for (const response of manualResponsesFromClient) {
        // Skip auto-populated questions that might be sent from client
        if (response.questionId === 'C5') {
          continue;
        }
        
        const questionData = questionMap.get(response.questionId);
        if (!questionData) {
          console.warn(`Question ID ${response.questionId} not found for cancer assessment`);
          continue;
        }
        
        let scoreForQuestion = 0;
        
        // Special handling for screening question C6
        if (response.questionId === 'C6') {
          scoreForQuestion = response.answer === 'Yes' ? -1 : 1; // Reduce risk if screened
        } else {
          scoreForQuestion = response.answer === 'Yes' ? questionData.weight : 0;
        }
        
        totalScore += scoreForQuestion;
        
        processedResponses.push({
          questionId: response.questionId,
          answer: response.answer,
          score: scoreForQuestion,
          autoPopulated: false
        });
      }
      
      // Ensure score is minimum 0
      totalScore = Math.max(0, totalScore);
      
      // Calculate risk level
      let riskLevel = 'Low';
      if (totalScore >= 9) riskLevel = 'Very High';
      else if (totalScore >= 7) riskLevel = 'High';
      else if (totalScore >= 5) riskLevel = 'Localized';
      else if (totalScore >= 3) riskLevel = 'Moderate';
      
      // Generate recommendations
      const recommendations = [
        "Consult with an oncologist or primary care physician to discuss your cancer risk.",
        "Consider regular cancer screenings based on your risk factors."
      ];
      
      if (hasDiabetes) {
        recommendations.push("As a diabetic patient, maintain healthy blood sugar levels to reduce cancer risk.");
      }
      
      // Save assessment
      const newAssessment = new Assessment({
        userId,
        type: 'cancer',
        responses: processedResponses,
        totalScore,
        riskLevel,
        recommendations,
      });
      
      await newAssessment.save();
      
      res.status(201).json({
        assessmentId: newAssessment._id,
        totalScore,
        riskLevel,
        recommendations,
      });
      
    } catch (error) {
      console.error("Error saving cancer assessment:", error);
      res.status(500).json({ message: 'Error saving assessment', error: String(error) });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 