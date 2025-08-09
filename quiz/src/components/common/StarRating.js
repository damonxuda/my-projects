import React from 'react';
import { Star } from 'lucide-react';

const StarRating = ({ 
  score = 0, 
  maxStars = 5, 
  size = 16, 
  interactive = false, 
  onRatingClick = null,
  showScore = false 
}) => {
  const handleStarClick = (starIndex) => {
    if (interactive && onRatingClick) {
      onRatingClick(starIndex + 1);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxStars }, (_, i) => (
        <Star
          key={i}
          size={size}
          className={`${
            i < score 
              ? 'fill-yellow-400 text-yellow-400' 
              : 'text-gray-300'
          } ${
            interactive 
              ? 'cursor-pointer hover:text-yellow-500 transition-colors' 
              : ''
          }`}
          onClick={() => handleStarClick(i)}
        />
      ))}
      {showScore && (
        <span className="text-sm text-gray-500 ml-1">
          ({score.toFixed(1)})
        </span>
      )}
    </div>
  );
};

export default StarRating;