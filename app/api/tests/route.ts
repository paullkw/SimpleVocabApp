import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Test } from '@/models/Test';
import { Question } from '@/models/Question';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Handle large payloads with images
export const config = {
  maxDuration: 30,
};

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  await connectToDatabase();

  const tests = await Test.find({ createdBy: session.user.id })
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

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { id, title, questions } = await request.json();

  console.log('[API PATCH] Received request:', {
    id,
    title: title?.substring(0, 50),
    questionsCount: Array.isArray(questions) ? questions.length : 'not an array',
    questionsData: Array.isArray(questions) ? questions.map((q, i) => ({
      index: i,
      text: q.text?.substring(0, 50),
      hasImage: !!q.image,
      imageLength: q.image?.length || 0,
      imageMimeType: q.imageMimeType,
    })) : null,
  });

  if (!id || typeof id !== 'string') {
    return NextResponse.json(
      { error: 'Test id is required' },
      { status: 400 }
    );
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json(
      { error: 'Title is required' },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const test = await Test.findById(id);

  if (!test) {
    return NextResponse.json(
      { error: 'Test not found' },
      { status: 404 }
    );
  }

  test.title = title.trim();
  test.updatedBy = session.user.id;

  // Handle questions if provided
  if (Array.isArray(questions)) {
    // Delete existing questions first
    await Question.deleteMany({ test: id });
    
    const questionIds = [];
    
    for (const q of questions) {
      if (!q.text || typeof q.text !== 'string' || !q.text.trim()) {
        return NextResponse.json(
          { error: 'All questions must have text' },
          { status: 400 }
        );
      }

      try {
        // Create or update question
        console.log(`[API PATCH] Creating question ${questions.indexOf(q) + 1}:`, {
          text: q.text?.substring(0, 50),
          imageLength: q.image?.length || 0,
          imageMimeType: q.imageMimeType,
          active: q.active,
        });

        const questionDoc = new Question({
          text: q.text.trim(),
          image: q.image || null,
          imageMimeType: q.imageMimeType || null,
          test: id,
          active: q.active ?? false,
        });

        const savedQuestion = await questionDoc.save();
        console.log(`[API PATCH] Saved question ${savedQuestion._id}:`, {
          text: savedQuestion.text?.substring(0, 50),
          imageLength: savedQuestion.image?.length || 0,
          imageMimeType: savedQuestion.imageMimeType,
          active: savedQuestion.active,
        });
        questionIds.push(savedQuestion._id);
      } catch (err) {
        console.error('[API PATCH] Error saving question:', err);
        return NextResponse.json(
          { error: 'Failed to save question: ' + (err instanceof Error ? err.message : 'Unknown error') },
          { status: 400 }
        );
      }
    }

    test.questions = questionIds;
  }

  await test.save();

  const updatedTest = await Test.findById(test._id)
    .populate('createdBy', 'username')
    .populate('updatedBy', 'username')
    .populate('questions');

  return NextResponse.json(updatedTest);
}
