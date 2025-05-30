/**
 * Link Prioritizer Module
 * 
 * This module identifies links on a page, analyzes their context,
 * and assigns priority scores for the scraping queue.
 */

import { URL } from 'url';
import type { ScraperAgentState } from '../types';

interface LinkInfo {
  url: string;
  text: string;
  context: string;
  predictedValue: number;
}

/**
 * Extract and prioritize links from HTML content
 */
export async function identifyLinks(
  html: string,
  currentUrl: string,
  state: ScraperAgentState
): Promise<LinkInfo[]> {
  // Extract all links from the HTML
  const links = extractLinks(html, currentUrl);
  
  // Filter out links that shouldn't be followed
  const filteredLinks = filterLinks(links, currentUrl, state);
  
  // Analyze link context and assign priority scores
  const analyzedLinks = analyzeLinks(filteredLinks, state);
  
  // Return the links sorted by predicted value
  return analyzedLinks.sort((a, b) => b.predictedValue - a.predictedValue);
}

/**
 * Extract all links from HTML content
 */
function extractLinks(html: string, baseUrl: string): LinkInfo[] {
  const links: LinkInfo[] = [];
  
  // Simple regex to extract links and their text
  // In a real implementation, you would use a proper HTML parser
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'](?:[^>]*?)>([^<]*)<\/a>/gi;
  
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const text = match[2].trim();
    
    // Skip empty links, javascript links, and anchor links
    if (!url || url.startsWith('javascript:') || url === '#') {
      continue;
    }
    
    try {
      // Resolve relative URLs to absolute URLs
      const absoluteUrl = new URL(url, baseUrl).toString();
      
      // Get some surrounding context (words before and after the link)
      // In a real implementation, you would extract proper context using DOM traversal
      const contextStart = Math.max(0, html.lastIndexOf(' ', match.index) - 50);
      const contextEnd = Math.min(html.length, match.index + match[0].length + 50);
      const context = html.substring(contextStart, contextEnd)
        .replace(/<[^>]+>/g, ' ')  // Remove HTML tags
        .replace(/\s+/g, ' ')      // Normalize whitespace
        .trim();
      
      links.push({
        url: absoluteUrl,
        text,
        context,
        predictedValue: 0  // Will be calculated later
      });
    } catch {
      // Skip invalid URLs
      console.error(`Failed to parse URL: ${url}`);
    }
  }
  
  return links;
}

/**
 * Filter out links that shouldn't be followed
 */
function filterLinks(
  links: LinkInfo[],
  currentUrl: string,
  state: ScraperAgentState
): LinkInfo[] {
  const currentUrlObj = new URL(currentUrl);
  const baseHost = currentUrlObj.hostname;
  
  return links.filter(link => {
    const linkUrl = new URL(link.url);
    
    // Skip links that have already been visited
    if (state.visitedUrls.has(link.url)) {
      return false;
    }
    
    // Skip links to other domains if we're staying within the same domain
    // This would be a configuration option in a real implementation
    if (linkUrl.hostname !== baseHost) {
      return false;
    }
    
    // Skip links to file types that we don't want to scrape
    const fileExtensions = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.rar', '.tar', '.gz', '.jpg', '.jpeg', '.png',
      '.gif', '.svg', '.mp3', '.mp4', '.avi', '.mov'
    ];
    
    if (fileExtensions.some(ext => linkUrl.pathname.endsWith(ext))) {
      return false;
    }
    
    // Skip links to common non-content pages
    const skipPatterns = [
      '/login', '/logout', '/signup', '/register',
      '/cart', '/checkout', '/account', '/profile',
      '/search', '/sitemap', '/privacy', '/terms'
    ];
    
    if (skipPatterns.some(pattern => linkUrl.pathname.includes(pattern))) {
      return false;
    }
    
    return true;
  });
}

/**
 * Analyze links and assign priority scores
 */
function analyzeLinks(
  links: LinkInfo[],
  state: ScraperAgentState
): LinkInfo[] {
  return links.map(link => {
    // Calculate a predicted value score for this link
    const predictedValue = calculateLinkValue(link, state);
    
    return {
      ...link,
      predictedValue
    };
  });
}

/**
 * Calculate the predicted value of a link
 */
function calculateLinkValue(link: LinkInfo, state: ScraperAgentState): number {
  let score = 0.5; // Start with a neutral score
  
  // Factor 1: Link text relevance to scraping goal
  score += calculateTextRelevance(link.text, state.scrapingGoal) * 0.3;
  
  // Factor 2: Link context relevance to scraping goal
  score += calculateTextRelevance(link.context, state.scrapingGoal) * 0.3;
  
  // Factor 3: URL structure analysis
  score += calculateUrlStructureScore(link.url) * 0.2;
  
  // Factor 4: Heuristic boosts/penalties
  score += calculateHeuristicScore(link) * 0.2;
  
  // Ensure the score is between 0 and 1
  return Math.max(0, Math.min(1, score));
}

/**
 * Calculate the relevance of text to the scraping goal
 */
function calculateTextRelevance(text: string, scrapingGoal: string): number {
  if (!text || text.length === 0) {
    return 0;
  }
  
  // Extract keywords from the scraping goal
  const goalKeywords = scrapingGoal.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  if (goalKeywords.length === 0) {
    return 0.5; // Neutral if no keywords
  }
  
  // Count how many keywords are in the text
  const lowerText = text.toLowerCase();
  let matchCount = 0;
  
  for (const keyword of goalKeywords) {
    if (lowerText.includes(keyword)) {
      matchCount++;
    }
  }
  
  // Calculate the relevance score
  return matchCount / goalKeywords.length;
}

/**
 * Calculate a score based on URL structure
 */
function calculateUrlStructureScore(url: string): number {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    // URLs deeper in the site structure might be more specific
    const pathDepth = path.split('/').filter(Boolean).length;
    const depthScore = Math.min(pathDepth / 5, 1) * 0.5;
    
    // Check if the URL contains high-value patterns
    const highValuePatterns = [
      '/docs', '/documentation', '/guide', '/tutorial',
      '/product', '/api', '/specification', '/details'
    ];
    
    let patternScore = 0;
    for (const pattern of highValuePatterns) {
      if (path.includes(pattern)) {
        patternScore = 0.5;
        break;
      }
    }
    
    return depthScore + patternScore;
  } catch {
    return 0;
  }
}

/**
 * Calculate a score based on heuristic rules
 */
function calculateHeuristicScore(link: LinkInfo): number {
  let score = 0;
  
  // Heuristic 1: Links with longer text might be more descriptive
  if (link.text.length > 20) {
    score += 0.1;
  }
  
  // Heuristic 2: Links with specific action words might be valuable
  const actionWords = ['learn', 'guide', 'tutorial', 'how', 'example', 'documentation'];
  for (const word of actionWords) {
    if (link.text.toLowerCase().includes(word)) {
      score += 0.2;
      break;
    }
  }
  
  // Heuristic 3: Links with numbers might indicate listings or versioned content
  if (/\d+/.test(link.text)) {
    score += 0.1;
  }
  
  // Heuristic 4: Links that appear to be headings might be section links
  if (link.text === link.text.toUpperCase() || link.text.length < 4) {
    score -= 0.1;
  }
  
  return score;
} 