import React from 'react';

export const LoadingSpinner: React.FC = () => (
  <div className="flex justify-center items-center space-x-2 animate-pulse">
    <div className="w-3 h-3 bg-cyan-400 rounded-full"></div>
    <div className="w-3 h-3 bg-cyan-400 rounded-full animation-delay-200"></div>
    <div className="w-3 h-3 bg-cyan-400 rounded-full animation-delay-400"></div>
  </div>
);