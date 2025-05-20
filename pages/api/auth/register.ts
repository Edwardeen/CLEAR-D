import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import dbConnect from '@/lib/dbConnect';
import User, { IUser } from '@/models/User';
// No longer need formidable or fs for this endpoint
// import formidable, { File as FormidableFile } from 'formidable';
// import fs from 'fs/promises'; 
// Cloudinary SDK is not needed here directly if URLs come from client
// import { v2 as cloudinary } from 'cloudinary';

// Cloudinary config is not needed here if client handles upload

const BCRYPT_SALT_ROUNDS = 10;

// Body parser config is removed, Next.js default JSON parser will be used
// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    await dbConnect();

    // Extract data directly from req.body, expecting JSON
    const { 
        email,
        password,
        photoUrl,       // Expecting Cloudinary URL from client
        photoPublicId,  // Expecting Cloudinary public_id from client
        ...otherData 
    } = req.body as Partial<IUser> & { password?: string; confirmPassword?: string; photoUrl?: string; photoPublicId?: string };

    // --- Basic Validation ---
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    // Since photo is mandatory (handled by client upload now), ensure URLs are present
    if (!photoUrl || !photoPublicId) {
        return res.status(400).json({ message: 'Profile picture URL and Public ID are required.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use.' });
    }

    // --- Hash Password ---
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // --- Create User ---
    const newUser = new User({
      ...otherData,
      email: email.toLowerCase(),
      password: hashedPassword,
      photoUrl: photoUrl,             // Save Cloudinary URL
      photoPublicId: photoPublicId, // Save Cloudinary Public ID
      role: 'user', // Default role
      allergies: otherData.allergies || [],
      vaccinationHistory: otherData.vaccinationHistory || [],
      currentMedications: otherData.currentMedications || [],
      name: otherData.name || {},
      address: otherData.address || {},
      emergencyContact: otherData.emergencyContact || {},
      insurance: otherData.insurance || {},
      dateOfBirth: otherData.dateOfBirth ? new Date(otherData.dateOfBirth) : undefined,
    });

    await newUser.save();

    const userObject = newUser.toObject();
    delete userObject.password;
    // photoPublicId is sensitive and not typically returned to client here, 
    // but photoUrl is fine. Depending on needs, can also remove photoPublicId from userObject.
    // delete userObject.photoPublicId;

    return res.status(201).json({ message: 'User registered successfully', user: userObject });

  } catch (error: any) {
    console.error('[API Register Error]', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation Error', errors: error.errors });
    }
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
} 