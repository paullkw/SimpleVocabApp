import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { Test } from '@/models/Test';
import { Question } from '@/models/Question';

export async function PATCH(
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
      { error: 'You do not have permission to reset incorrect counts for this test' },
      { status: 403 }
    );
  }

  const result = await Question.updateMany(
    { test: test._id },
    { $set: { totalIncorrectCount: 0 } }
  );

  test.updatedBy = session.user.id;
  await test.save();

  return NextResponse.json({
    message: 'Incorrect counts reset successfully',
    updatedQuestions: result.modifiedCount,
  });
}
