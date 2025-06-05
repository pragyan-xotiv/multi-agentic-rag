/**
 * URL Analyzer Module
 * 
 * This module analyzes URLs to determine their relevance to the scraping goal,
 * checks domain authority, applies robots.txt restrictions, and calculates
 * expected information value.
 */

import { URL } from 'url';
import type { ExtendedScraperAgentState } from '../state';

interface UrlAnalysisResult {
  url: string;
  relevanceScore: number;
  expectedValue: number;
  isAllowedByRobots: boolean;
  domainAuthority: number;
  wasVisitedBefore: boolean;
}

/**
 * Analyzes a URL to determine its potential value for scraping
 */
export async function analyzeUrl(
  url: string,
  state: ExtendedScraperAgentState,
): Promise<UrlAnalysisResult> {
  // Parse the URL to get components
  const parsedUrl = new URL(url);
  
  // Check if the URL was visited before
  const wasVisitedBefore = state.visitedUrls.has(url);
  
  // Calculate relevance score based on URL path and query parameters
  // This is a simple implementation; in a real system, you would use more
  // sophisticated methods like semantic similarity to the scraping goal
  const relevanceScore = calculateRelevanceScore(
    parsedUrl,
    state.scrapingGoal
  );
  
  // Calculate expected information value based on relevance and other factors
  const expectedValue = calculateExpectedValue(
    relevanceScore,
    wasVisitedBefore,
    parsedUrl
  );
  
  // Check if the URL is allowed by robots.txt
  const isAllowedByRobots = await checkRobotsPermission(parsedUrl);
  
  // Estimate domain authority (could use actual SEO metrics in a real implementation)
  const domainAuthority = estimateDomainAuthority(parsedUrl.hostname);
  
  return {
    url,
    relevanceScore,
    expectedValue,
    isAllowedByRobots,
    domainAuthority,
    wasVisitedBefore,
  };
}

/**
 * Calculates a relevance score for a URL based on the scraping goal
 */
function calculateRelevanceScore(parsedUrl: URL, scrapingGoal: string): number {
  // Convert both to lowercase for case-insensitive matching
  const path = parsedUrl.pathname.toLowerCase();
  const goal = scrapingGoal.toLowerCase();
  
  // Extract keywords from the scraping goal
  const keywords = extractKeywords(goal);
  
  // Check how many keywords are in the path
  let matchCount = 0;
  for (const keyword of keywords) {
    if (path.includes(keyword)) {
      matchCount++;
    }
  }
  
  // Calculate a score based on keyword matches
  const keywordScore = keywords.length > 0 
    ? matchCount / keywords.length 
    : 0;
  
  // Adjust score based on path depth (assumption: deeper pages might have more specific info)
  const pathSegments = path.split('/').filter(Boolean);
  const depthScore = Math.min(pathSegments.length / 5, 1); // Normalize to 0-1
  
  // Combine scores (could use different weights in a real implementation)
  return 0.7 * keywordScore + 0.3 * depthScore;
}

/**
 * Calculates the expected information value of a URL
 */
function calculateExpectedValue(
  relevanceScore: number,
  wasVisitedBefore: boolean,
  parsedUrl: URL
): number {
  // If already visited, the expected value is much lower
  if (wasVisitedBefore) {
    return relevanceScore * 0.1;
  }
  
  // Adjust based on URL features
  let valueScore = relevanceScore;
  
  // Penalize URLs with certain patterns that typically have low value
  const lowValuePatterns = [
    '/login', '/signup', '/contact', '/about', 
    '/terms', '/privacy', '/cart', '/checkout'
  ];
  
  for (const pattern of lowValuePatterns) {
    if (parsedUrl.pathname.includes(pattern)) {
      valueScore *= 0.5;
      break;
    }
  }
  
  // Boost URLs with high-value patterns
  const highValuePatterns = [
    '/docs', '/documentation', '/guide', '/tutorial',
    '/product', '/api', '/specification', '/details'
  ];
  
  for (const pattern of highValuePatterns) {
    if (parsedUrl.pathname.includes(pattern)) {
      valueScore = Math.min(valueScore * 1.5, 1);
      break;
    }
  }
  
  return valueScore;
}

/**
 * Checks if a URL is allowed to be scraped according to robots.txt
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function checkRobotsPermission(parsedUrl: URL): Promise<boolean> {
  // In a real implementation, this would fetch and parse the robots.txt file
  // For now, we'll just return true as a placeholder
  try {
    // Here you would:
    // 1. Fetch robots.txt from the domain
    // 2. Parse it
    // 3. Check if the user-agent is allowed to access the path
    return true;
  } catch (error) {
    console.error('Error checking robots.txt:', error);
    // Default to being cautious if we can't check
    return false;
  }
}

/**
 * Estimates the domain authority of a website
 */
function estimateDomainAuthority(hostname: string): number {
  // In a real implementation, this would use an SEO API or database
  // For now, we'll just return a random score as a placeholder
  
  // Some well-known domains get a high score
  if (
    hostname.includes('github.com') ||
    hostname.includes('stackoverflow.com') ||
    hostname.includes('wikipedia.org')
  ) {
    return 0.9;
  }
  
  // Default score for unknown domains
  return 0.5;
}

/**
 * Extracts keywords from a text string
 */
function extractKeywords(text: string): string[] {
  // Remove common words
  const stopWords = [
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'with', 'about', 'from', 'by', 'is', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'of', 'that', 'this',
    'these', 'those', 'they', 'we', 'you', 'i', 'he', 'she', 'it',
  ];
  
  // Split the text into words, convert to lowercase, and filter out stop words
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/) // Split by whitespace
    .filter(word => word.length > 2 && !stopWords.includes(word));
} 