import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      default: null,
    },
    imageMimeType: {
      type: String,
      default: null,
    },
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      required: true,
    },
    active: {
      type: Boolean,
      default: false,
    },
    consecutiveCorrectCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalIncorrectCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Question = mongoose.models.Question || mongoose.model('Question', questionSchema);
