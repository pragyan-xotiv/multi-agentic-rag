"use client";

import { useState } from 'react';

interface StreamingToggleProps {
  onToggle: (enabled: boolean) => void;
  initialState?: boolean;
}

export default function StreamingToggle({ onToggle, initialState = true }: StreamingToggleProps) {
  const [enabled, setEnabled] = useState(initialState);

  const handleToggle = () => {
    const newState = !enabled;
    setEnabled(newState);
    onToggle(newState);
  };

  return (
    <div className="flex items-center space-x-3 rounded-md bg-gray-100 p-2">
      <button
        onClick={handleToggle}
        type="button"
        className={`relative inline-flex h-6 w-11 items-center rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          enabled ? 'bg-blue-600' : 'bg-gray-300'
        }`}
        aria-pressed={enabled}
      >
        <span className="sr-only">Enable streaming</span>
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className="text-sm font-medium text-gray-900">
        {enabled ? 'Streaming enabled' : 'Streaming disabled'}
      </span>
      <div className="ml-2 text-xs text-gray-500">
        {enabled 
          ? 'See results in real-time as they arrive' 
          : 'Wait for complete results'}
      </div>
    </div>
  );
} 