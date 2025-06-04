'use client';

import { useState } from 'react';
import ScraperStatusViewer from '@/components/ScraperStatusViewer';

interface ScrapingSummary {
  pagesScraped: number;
  totalContentSize: number;
  executionTime: number;
  goalCompletion: number;
  coverageScore: number;
}

export default function ScraperDemoPage() {
  const [summary, setSummary] = useState<ScrapingSummary | null>(null);
  
  const handleScrapingComplete = (result: ScrapingSummary) => {
    console.log('Scraping completed:', result);
    setSummary(result);
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Web Scraper Demo</h1>
      <p className="mb-8 text-gray-600">
        This demo shows real-time updates from the non-recursive web scraper.
        Enter a URL and a scraping goal to start.
      </p>
      
      {summary && (
        <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded">
          <h2 className="text-xl font-semibold mb-2 text-green-800">Scraping Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Pages Scraped</div>
              <div className="text-2xl font-bold">{summary.pagesScraped}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Content Size</div>
              <div className="text-2xl font-bold">{(summary.totalContentSize / 1024).toFixed(1)} KB</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Execution Time</div>
              <div className="text-2xl font-bold">{(summary.executionTime / 1000).toFixed(1)}s</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Goal Completion</div>
              <div className="text-2xl font-bold">{Math.round(summary.goalCompletion * 100)}%</div>
            </div>
          </div>
        </div>
      )}
      
      <ScraperStatusViewer onComplete={handleScrapingComplete} />
    </div>
  );
} 