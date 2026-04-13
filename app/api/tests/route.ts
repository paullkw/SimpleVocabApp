import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Test } from '@/models/Test';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  await connectToDatabase();

  const tests = await Test.find()
    .populate('createdBy', 'username')
    .populate('updatedBy', 'username')
    .sort({ createdAt: -1 });

  return NextResponse.json(tests);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { title } = await request.json();

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json(
      { error: 'Title is required' },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const test = new Test({
    title: title.trim(),
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  await test.save();

  const createdTest = await Test.findById(test._id)
    .populate('createdBy', 'username')
    .populate('updatedBy', 'username');

  return NextResponse.json(createdTest, { status: 201 });
}
