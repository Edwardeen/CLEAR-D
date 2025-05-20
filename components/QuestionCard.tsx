import React from 'react';

interface QuestionCardProps {
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  questionId: string;
  onAnswer: (questionId: string, answer: string) => void;
  // Theme color for the 'Yes' button, e.g., 'green' or 'pink'
  themeColor: 'green' | 'pink'; 
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  questionNumber,
  totalQuestions,
  questionText,
  questionId,
  onAnswer,
  themeColor,
}) => {
  const yesButtonClass = `px-8 py-3 text-white font-semibold rounded-lg shadow-md transition-colors text-lg ${themeColor === 'green' ? 'bg-green-500 hover:bg-green-600' : 'bg-pink-500 hover:bg-pink-600'}`;
  const noButtonClass = "px-8 py-3 bg-gray-300 text-gray-700 font-semibold rounded-lg shadow-md hover:bg-gray-400 transition-colors text-lg";

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-xl text-center">
      {/* Topic/Header for the question - Larger font */}
      <h2 className="text-xl font-semibold text-gray-500 mb-2">
        Question {questionNumber} of {totalQuestions}
      </h2>
      {/* Question text - Larger font */}
      <p className="text-2xl font-semibold text-gray-700 mb-8 min-h-[6em] flex items-center justify-center">
        {questionText}
      </p>
      <div className="flex justify-around space-x-4">
        <button 
          onClick={() => onAnswer(questionId, 'Yes')}
          className={yesButtonClass}
        >
          Yes
        </button>
        <button 
          onClick={() => onAnswer(questionId, 'No')}
          className={noButtonClass}
        >
          No
        </button>
        {/* Example for a 'Not Sure' option if needed in the future */}
        {/* 
        <button 
          onClick={() => onAnswer(questionId, 'Not Sure')}
          className="px-6 py-3 bg-yellow-400 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-500 transition-colors text-lg"
        >
          Not Sure
        </button> 
        */}
      </div>
    </div>
  );
};

export default QuestionCard; 