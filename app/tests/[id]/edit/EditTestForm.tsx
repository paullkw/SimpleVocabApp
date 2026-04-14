'use client';

import { FormEvent, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Question = {
  id?: string;
  text: string;
  image: string;
  imageMimeType: string;
};

type Props = {
  testId: string;
  initialTitle: string;
  createdBy: string;
  updatedBy: string;
  initialQuestions?: Question[];
};

export default function EditTestForm({ testId, initialTitle, createdBy, updatedBy, initialQuestions = [] }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const imagesRef = useRef<Map<number, { base64: string; mimeType: string }>>(new Map());

  const handleAddQuestion = () => {
    setQuestions([...questions, { text: '', image: '', imageMimeType: '' }]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
    imagesRef.current.delete(index);
  };

  const handleQuestionChange = (index: number, field: keyof Question, value: string) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setQuestions(updatedQuestions);
  };

  const handleImageUpload = (index: number, file: File) => {
    try {
      console.log(`[Image Upload] Starting for question ${index}, file: ${file.name}, size: ${file.size}`);
      
      // Limit image size to 5MB
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        setError(`Image must be smaller than 5MB. File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        console.log(`[Image Upload] FileReader complete for question ${index}, Base64 length: ${base64.length}`);
        
        // Store in ref first (reliable)
        imagesRef.current.set(index, { base64, mimeType: file.type });
        
        // Also update state for preview
        const updatedQuestions = [...questions];
        updatedQuestions[index] = { 
          ...updatedQuestions[index], 
          image: base64,
          imageMimeType: file.type 
        };
        setQuestions(updatedQuestions);
        
        console.log(`[Image Upload] Image stored in ref and state for question ${index}`);
      };
      
      reader.onerror = () => {
        console.error(`[Image Upload] FileReader error for question ${index}`);
        setError('Failed to read image file');
      };
      
      console.log(`[Image Upload] Starting FileReader.readAsDataURL for question ${index}`);
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('[Image Upload] Exception:', err);
      setError('Failed to upload image');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    if (questions.some(q => !q.text.trim())) {
      setError('All questions must have text');
      return;
    }

    console.log('=== FORM SUBMISSION START ===');
    console.log('imagesRef current map:', Array.from(imagesRef.current.entries()));
    
    setSaving(true);

    try {
      const questionsToSend = questions.map((q, index) => {
        // Use ref data as primary source for images
        const storedImage = imagesRef.current.get(index);
        const imageData = storedImage ? storedImage.base64 : (q.image || '');
        const imageMimeType = storedImage ? storedImage.mimeType : (q.imageMimeType || '');
        
        console.log(`Question ${index} submission:`, {
          text: q.text.substring(0, 50),
          hasImage: !!imageData,
          imageLength: imageData.length,
          imageMimeType: imageMimeType,
        });
        
        return {
          text: q.text.trim(),
          image: imageData,
          imageMimeType: imageMimeType,
        };
      });

      const payload = { 
        id: testId, 
        title: title.trim(),
        questions: questionsToSend,
      };

      console.log('Payload payload size:', JSON.stringify(payload).length, 'bytes');
      console.log('Total image data bytes:', questionsToSend.reduce((sum, q) => sum + q.image.length, 0));

      const response = await fetch('/api/tests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('API Response:', data);

      if (!response.ok) {
        setError(data.error || 'Failed to update test');
        console.error('API error:', data);
      } else {
        console.log('Test updated successfully');
        router.push('/');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError('Unable to update test: ' + errorMsg);
      console.error('Error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm">
      <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Questions
              </label>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="rounded-2xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                + Add Question
              </button>
            </div>
            
            {questions.length === 0 ? (
              <p className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                No questions yet. Click "Add Question" to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <div key={index} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Question {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(index)}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Text
                      </label>
                      <textarea
                        value={question.text}
                        onChange={(e) => handleQuestionChange(index, 'text', e.target.value)}
                        placeholder="Enter question text"
                        className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                        rows={2}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Image (Optional)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleImageUpload(index, e.target.files[0]);
                          }
                        }}
                        className="block w-full text-sm text-gray-600 file:rounded-2xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
                      />
                      {question.image && (
                        <div className="mt-2">
                          <img
                            src={question.image}
                            alt={`Question ${index + 1}`}
                            className="h-24 w-24 rounded-lg object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleQuestionChange(index, 'image', '');
                              handleQuestionChange(index, 'imageMimeType', '');
                            }}
                            className="mt-1 text-xs text-red-600 hover:text-red-700"
                          >
                            Remove image
                          </button>
                          <div className="mt-1 text-xs text-gray-500">
                            Image loaded: {(question.image.length / 1024).toFixed(2)}KB
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <p>
              Created by <span className="font-medium text-gray-900">{createdBy}</span>
            </p>
            <p>
              Updated by <span className="font-medium text-gray-900">{updatedBy}</span>
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
    </div>
  );
}
