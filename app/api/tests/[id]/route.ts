import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Test } from '@/models/Test';
import { Question } from '@/models/Question';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await context.params;
  await connectToDatabase();

  const test = await Test.findById(params.id);

  if (!test) {
    return NextResponse.json({ error: 'Test not found' }, { status: 404 });
  }

  const testCreatorId = String(test.createdBy || '');
  const currentUserId = String(session.user.id || '');

  if (!testCreatorId || testCreatorId !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to delete this test' },
      { status: 403 }
    );
  }

  await Question.deleteMany({ test: test._id });
  await Test.deleteOne({ _id: test._id });

  return NextResponse.json({ message: 'Test deleted successfully' });
}
