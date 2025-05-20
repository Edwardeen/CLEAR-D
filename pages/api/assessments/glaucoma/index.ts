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
      const user = await User.findById(userId).select('hasDiabetes dateOfBirth').lean();
      
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }
      
      // Process user data
      const hasDiabetes = user.hasDiabetes === true;
      let age = 0;
      
      if (user.dateOfBirth) {
        const today = new Date();
        const birthDate = new Date(user.dateOfBirth);
        age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }
      
      // Get all glaucoma questions from DB
      const allQuestions = await QuestionBank.find({ type: 'glaucoma' }).lean();
      const questionMap = new Map();
      allQuestions.forEach(q => questionMap.set(q.questionId, q));
      
      let totalScore = 0;
      const processedResponses = [];
      
      // Process automatic questions (diabetes & age)
      const diabetesQuestion = questionMap.get('G7');
      if (diabetesQuestion) {
        const answer = hasDiabetes ? 'Yes' : 'No';
        const score = hasDiabetes ? diabetesQuestion.weight : 0;
        totalScore += score;
        processedResponses.push({
          questionId: 'G7',
          answer,
          score,
          autoPopulated: true
        });
      }
      
      const ageQuestion = questionMap.get('G11');
      if (ageQuestion) {
        const answer = age > 40 ? 'Yes' : 'No';
        const score = age > 40 ? ageQuestion.weight : 0;
        totalScore += score;
        processedResponses.push({
          questionId: 'G11',
          answer,
          score,
          autoPopulated: true
        });
      }
      
      // Process manual responses
      for (const response of manualResponsesFromClient) {
        // Skip auto-populated questions that might be sent from client
        if (response.questionId === 'G7' || response.questionId === 'G11') {
          continue;
        }
        
        const questionData = questionMap.get(response.questionId);
        if (!questionData) {
          console.warn(`Question ID ${response.questionId} not found for glaucoma assessment`);
          continue;
        }
        
        const scoreForQuestion = response.answer === 'Yes' ? questionData.weight : 0;
        totalScore += scoreForQuestion;
        
        processedResponses.push({
          questionId: response.questionId,
          answer: response.answer,
          score: scoreForQuestion,
          autoPopulated: false
        });
      }
      
      // Calculate risk level
      let riskLevel = 'Low';
      if (totalScore >= 8) riskLevel = 'Critical';
      else if (totalScore >= 5) riskLevel = 'High';
      else if (totalScore >= 2.1) riskLevel = 'Moderate';
      
      // Generate recommendations
      const recommendations = [
        "Consult with an ophthalmologist for a comprehensive eye examination.",
        "Regular eye pressure checks are recommended."
      ];
      
      if (hasDiabetes) {
        recommendations.push("As a diabetic patient, annual comprehensive eye exams are crucial.");
      }
      
      if (age > 40) {
        recommendations.push("Given your age profile, increased screening frequency is advised.");
      }
      
      // Save assessment
      const newAssessment = new Assessment({
        userId,
        type: 'glaucoma',
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
      console.error("Error saving glaucoma assessment:", error);
      res.status(500).json({ message: 'Error saving assessment', error: String(error) });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 