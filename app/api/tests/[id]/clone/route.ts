import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { Test } from '@/models/Test';
import { Question } from '@/models/Question';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await context.params;
  const body = await request.json();
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const selectedQuestionIds = Array.isArray(body?.selectedQuestionIds)
    ? body.selectedQuestionIds.filter((id: unknown) => typeof id === 'string' && id.trim())
    : [];

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  if (selectedQuestionIds.length === 0) {
    return NextResponse.json({ error: 'Please select at least one question' }, { status: 400 });
  }

  await connectToDatabase();

  const sourceTest = await Test.findById(params.id).populate('questions');

  if (!sourceTest) {
    return NextResponse.json({ error: 'Test not found' }, { status: 404 });
  }

  const sourceCreatorId = String(sourceTest.createdBy || '');
  const currentUserId = String(session.user.id || '');

  if (!sourceCreatorId || sourceCreatorId !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to clone this test' },
      { status: 403 }
    );
  }

  const sourceQuestionDocs = await Question.find({
    _id: { $in: selectedQuestionIds },
    test: sourceTest._id,
  });

  if (sourceQuestionDocs.length === 0) {
    return NextResponse.json({ error: 'No valid questions selected' }, { status: 400 });
  }

  const sourceById = new Map(sourceQuestionDocs.map((q) => [String(q._id), q]));
  const orderedSourceQuestions = selectedQuestionIds
    .map((id: string) => sourceById.get(String(id)))
    .filter(Boolean) as typeof sourceQuestionDocs;

  const clonedTest = new Test({
    title,
    createdBy: session.user.id,
    updatedBy: session.user.id,
    consecutiveCorrectToDeactivate: Number(sourceTest.consecutiveCorrectToDeactivate || 3),
  });

  await clonedTest.save();

  const clonedQuestionDocs = await Question.insertMany(
    orderedSourceQuestions.map((question) => ({
      text: question.text,
      image: question.image || null,
      imageMimeType: question.imageMimeType || null,
      test: clonedTest._id,
      active: true,
      consecutiveCorrectCount: 0,
      totalIncorrectCount: 0,
    }))
  );

  clonedTest.questions = clonedQuestionDocs.map((q) => q._id);
  await clonedTest.save();

  const createdTest = await Test.findById(clonedTest._id)
    .populate('createdBy', 'username')
    .populate('updatedBy', 'username');

  return NextResponse.json(createdTest, { status: 201 });
}
