'use client';

import { StreamingSearch } from '@/components/StreamingSearch';
import { Toaster } from 'sonner';

export default function SearchPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Knowledge Search</h1>
      <p className="text-gray-500 mb-6">
        Search the knowledge base using the retrieval agent
      </p>
      
      <div className="bg-card p-4 rounded-lg shadow-sm border">
        <StreamingSearch />
      </div>
      
      <Toaster />
    </div>
  );
} 