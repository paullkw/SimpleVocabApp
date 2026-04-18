import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Question } from '@/models/Question';

export async function GET() {
  await connectToDatabase();

  const questions = await Question.find({}, 'text image imageMimeType');

  return NextResponse.json(questions);
}