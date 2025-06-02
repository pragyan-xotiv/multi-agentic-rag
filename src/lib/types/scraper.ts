// Scraper Event Types
export type EventTypes = 'start' | 'page' | 'auth' | 'error' | 'end';

export interface PageData {
  url: string;
  title: string;
  metrics: {
    relevance: number;
    informationDensity: number;
    uniqueness?: number;
    contentQualityAnalysis?: string;
  };
  links?: string[];
}

export interface AuthRequest {
  url: string;
  authType: string;
  formFields?: string[];
}

export interface ScraperSummary {
  pagesScraped: number;
  goalCompletion: number;
  executionTime: number;
}

export interface StartEvent {
  type: 'start';
  url: string;
  goal: string;
}

export interface PageEvent {
  type: 'page';
  data: PageData;
}

export interface AuthEvent {
  type: 'auth';
  request: AuthRequest;
}

export interface ErrorEvent {
  type: 'error';
  error: string;
}

export interface EndEvent {
  type: 'end';
  output: ScraperResultsType;
}

export type ScraperEvent = StartEvent | PageEvent | AuthEvent | ErrorEvent | EndEvent;

export interface ScraperResultsType {
  pages: Array<{
    url: string;
    title: string;
    content: string;
    contentType: string;
    extractionTime: string;
    metrics: {
      informationDensity: number;
      relevance: number;
      uniqueness: number;
      contentQualityAnalysis?: string;
    };
    links: Array<{
      url: string;
      context: string;
      predictedValue: number;
      visited: boolean;
    }>;
    entities?: Array<{
      name: string;
      type: string;
      mentions?: number;
      relevance?: number;
    }>;
  }>;
  summary: {
    pagesScraped: number;
    totalContentSize: number;
    executionTime: number;
    goalCompletion: number;
    coverageScore: number;
  };
}

export interface ScrapingConfig {
  baseUrl: string;
  scrapingGoal: string;
  maxPages: number;
  maxDepth: number;
  includeImages: boolean;
  executeJavaScript?: boolean;
  filters: {
    mustIncludePatterns: string;
    excludePatterns: string;
  };
} 