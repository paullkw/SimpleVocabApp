import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Test } from '@/models/Test';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  await connectToDatabase();

  const test = await Test.findById(params.id)
    .populate('createdBy', 'username')
    .populate('updatedBy', 'username')
    .populate('questions', 'text image imageMimeType active');

  if (!test) {
    return NextResponse.json({ error: 'Test not found' }, { status: 404 });
  }

  return NextResponse.json(test);
}
