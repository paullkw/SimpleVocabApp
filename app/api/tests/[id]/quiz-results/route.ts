import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { Test } from '@/models/Test';
import { Question } from '@/models/Question';

type SubmittedAnswer = {
  questionId: string;
  isCorrect: boolean;
};

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
  const answers = Array.isArray(body.answers) ? (body.answers as SubmittedAnswer[]) : null;

  if (!answers) {
    return NextResponse.json({ error: 'Answers are required' }, { status: 400 });
  }

  await connectToDatabase();

  const test = await Test.findById(params.id);

  if (!test) {
    return NextResponse.json({ error: 'Test not found' }, { status: 404 });
  }

  const testCreatorId = String(test.createdBy || '');
  const currentUserId = String(session.user.id || '');

  if (!testCreatorId || testCreatorId !== currentUserId) {
    return NextResponse.json(
      { error: 'You do not have permission to submit quiz results for this test' },
      { status: 403 }
    );
  }

  const threshold = Number(test.consecutiveCorrectToDeactivate || 3);
  let deactivatedQuestions = 0;

  for (const answer of answers) {
    if (!answer?.questionId || typeof answer.isCorrect !== 'boolean') {
      continue;
    }

    const question = await Question.findOne({ _id: answer.questionId, test: test._id });

    if (!question) {
      continue;
    }

    if (answer.isCorrect) {
      question.consecutiveCorrectCount = Number(question.consecutiveCorrectCount || 0) + 1;

      if (question.consecutiveCorrectCount >= threshold) {
        if (question.active) {
          deactivatedQuestions += 1;
        }
        question.active = false;
      }
    } else {
      question.consecutiveCorrectCount = 0;
    }

    await question.save();
  }

  if (answers.length > 0) {
    test.updatedBy = session.user.id;
    await test.save();
  }

  return NextResponse.json({
    message: 'Quiz results saved successfully',
    deactivatedQuestions,
  });
}