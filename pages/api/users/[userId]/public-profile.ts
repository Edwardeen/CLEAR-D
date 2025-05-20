import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../../lib/dbConnect';
import User, { IUser } from '../../../../models/User';
import Assessment, { IAssessment } from '../../../../models/Assessment';
import mongoose from 'mongoose';

interface PublicUser {
  fullName?: string;
  dateOfBirth?: string;
  gender?: string;
  country?: string;
  state?: string;
  profession?: string;
  race?: string;
  hasDiabetes?: boolean;
  photoUrl?: string;
}

// Define a type for assessments with string dates instead of Date objects
interface AssessmentWithStringDates extends Omit<IAssessment, 'createdAt' | 'updatedAt'> {
  createdAt?: string;
  updatedAt?: string;
  _id: string;
}

interface LatestAssessmentsByType {
  [type: string]: AssessmentWithStringDates | null;
}

interface PublicProfileData {
  user: PublicUser;
  assessments: AssessmentWithStringDates[]; // All assessments sorted by date
  latestAssessmentsByType: LatestAssessmentsByType;
}

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublicProfileData | ErrorResponse>
) {
  const { method } = req;
  const { userId } = req.query;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${method} Not Allowed` });
  }

  if (!userId || typeof userId !== 'string' || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: 'Invalid User ID provided.' });
  }

  try {
    await dbConnect();

    const user = await User.findById(userId)
      .select('name dateOfBirth gender address.country address.state profession race hasDiabetes photoUrl')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const allAssessments = await Assessment.find({ userId: userId })
      .sort({ createdAt: -1 })
      .lean();

    // Group assessments by type and find the latest for each
    const latestAssessmentsByType: LatestAssessmentsByType = {};
    const assessmentTypes = new Set(allAssessments.map(a => a.type));
    
    // Convert Set to Array for safer iteration in TypeScript
    const typeArray = Array.from(assessmentTypes);
    
    for (const type of typeArray) {
      const latestForType = allAssessments
        .filter(a => a.type === type)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (latestForType) {
        latestAssessmentsByType[type] = {
            ...latestForType,
            _id: latestForType._id.toString(),
            createdAt: latestForType.createdAt ? new Date(latestForType.createdAt).toISOString() : undefined,
            updatedAt: latestForType.updatedAt ? new Date(latestForType.updatedAt).toISOString() : undefined,
        };
      }
    }
    
    const fullName = user.name ? `${user.name.first || ''} ${user.name.last || ''}`.trim() : 'N/A';
    
    const publicProfile: PublicProfileData = {
      user: {
        fullName: fullName,
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString('en-CA') : undefined,
        gender: user.gender,
        country: user.address?.country,
        state: user.address?.state,
        profession: user.profession,
        race: user.race,
        hasDiabetes: user.hasDiabetes,
        photoUrl: user.photoUrl,
      },
      assessments: allAssessments.map(assessment => ({
        ...assessment,
        _id: assessment._id.toString(),
        createdAt: assessment.createdAt ? new Date(assessment.createdAt).toISOString() : undefined,
        updatedAt: assessment.updatedAt ? new Date(assessment.updatedAt).toISOString() : undefined,
      })), // Still send all assessments for the history section
      latestAssessmentsByType,
    };

    return res.status(200).json(publicProfile);

  } catch (error: any) {
    console.error('API Error fetching public profile:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
} 