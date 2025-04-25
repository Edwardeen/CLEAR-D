import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import dbConnect from '../../lib/dbConnect';
import User from '../../models/User';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  await dbConnect();

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10); // Salt rounds: 10

    // Create new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: 'user', // Default role
    });

    await newUser.save();

    return res.status(201).json({ message: 'User registered successfully' });

  } catch (error) {
    console.error('Registration Error:', error);
     if (error instanceof Error && error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Validation Error', errors: (error as any).errors });
    } else if (error instanceof Error && (error as any).code === 11000) { // Handle duplicate key error more specificly
         return res.status(409).json({ message: 'Email already in use.' });
    }
    return res.status(500).json({ message: 'Internal Server Error' });
  }
} 