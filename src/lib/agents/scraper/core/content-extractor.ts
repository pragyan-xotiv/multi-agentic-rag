/**
 * Content Extractor Module
 * 
 * This module extracts valuable content from web pages,
 * focusing on high-value elements while ignoring navigation, ads, etc.
 */

import type { ScraperAgentState } from '../types';

interface ExtractionResult {
  title: string;
  content: string;
  contentType: string;
  metrics: {
    informationDensity: number;
    relevance: number;
    uniqueness: number;
  };
}

/**
 * Extract valuable content from a web page
 */
export async function extractContent(
  html: string,
  url: string,
  state: ScraperAgentState
): Promise<ExtractionResult> {
  // In a real implementation, you would use a proper HTML parser like Cheerio
  // For this example, we'll use simplified extraction logic
  
  // Extract title
  const title = extractTitle(html);
  
  // Extract main content, removing boilerplate, navigation, ads, etc.
  const mainContent = extractMainContent(html);
  
  // Calculate metrics about the extracted content
  const metrics = calculateContentMetrics(mainContent, state);
  
  return {
    title,
    content: mainContent,
    contentType: 'text/html',
    metrics,
  };
}

/**
 * Extract the title from HTML
 */
function extractTitle(html: string): string {
  // Simple regex to extract title
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  return titleMatch ? titleMatch[1] : 'Untitled Page';
}

/**
 * Extract the main content from HTML, removing navigation, ads, etc.
 */
function extractMainContent(html: string): string {
  // In a real implementation, this would use more sophisticated approaches:
  // 1. DOM-based content extraction
  // 2. Readability algorithms (like what browsers use for "reader mode")
  // 3. ML-based content extraction
  
  // Simplified approach for demonstration:
  
  // Remove common non-content elements
  let processedHtml = html;
  
  // Remove header
  processedHtml = processedHtml.replace(/<header.*?>.*?<\/header>/i, '');
  
  // Remove navigation
  processedHtml = processedHtml.replace(/<nav.*?>.*?<\/nav>/i, '');
  
  // Remove footer
  processedHtml = processedHtml.replace(/<footer.*?>.*?<\/footer>/i, '');
  
  // Remove sidebars
  processedHtml = processedHtml.replace(/<aside.*?>.*?<\/aside>/i, '');
  
  // Remove scripts - use global flag with multiple passes instead of /s flag
  processedHtml = processedHtml.replace(/<script.*?>.*?<\/script>/gi, '');
  
  // Remove styles - use global flag with multiple passes instead of /s flag
  processedHtml = processedHtml.replace(/<style.*?>.*?<\/style>/gi, '');
  
  // Try to find main content area
  const mainMatch = processedHtml.match(/<main.*?>(.*?)<\/main>/i);
  if (mainMatch) {
    return cleanHtml(mainMatch[1]);
  }
  
  // Try to find article content
  const articleMatch = processedHtml.match(/<article.*?>(.*?)<\/article>/i);
  if (articleMatch) {
    return cleanHtml(articleMatch[1]);
  }
  
  // Try to find div with content-related IDs or classes
  const contentDivRegex = /<div.*?(?:id|class)=["'](?:content|main|article)["'].*?>(.*?)<\/div>/i;
  const contentDivMatch = processedHtml.match(contentDivRegex);
  if (contentDivMatch) {
    return cleanHtml(contentDivMatch[1]);
  }
  
  // Fallback: just return the body content
  const bodyMatch = processedHtml.match(/<body.*?>(.*?)<\/body>/i);
  if (bodyMatch) {
    return cleanHtml(bodyMatch[1]);
  }
  
  // If all fails, return the original HTML with basic cleaning
  return cleanHtml(processedHtml);
}

/**
 * Clean HTML content by removing tags and normalizing whitespace
 */
function cleanHtml(html: string): string {
  // Remove all HTML tags
  let text = html.replace(/<[^>]*>/g, ' ');
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Normalize whitespace
  text = text
    .replace(/\s+/g, ' ')
    .trim();
  
  return text;
}

/**
 * Calculate metrics about the extracted content
 */
function calculateContentMetrics(
  content: string,
  state: ScraperAgentState
): {
  informationDensity: number;
  relevance: number;
  uniqueness: number;
} {
  // Information density: ratio of meaningful content to total content
  const informationDensity = calculateInformationDensity(content);
  
  // Relevance: how relevant the content is to the scraping goal
  const relevance = calculateRelevance(content, state.scrapingGoal);
  
  // Uniqueness: how unique this content is compared to already extracted content
  const uniqueness = calculateUniqueness(content, state);
  
  return {
    informationDensity,
    relevance,
    uniqueness,
  };
}

/**
 * Calculate the information density of content
 */
function calculateInformationDensity(content: string): number {
  // In a real implementation, this would use more sophisticated approaches like:
  // - Text statistics (lexical diversity)
  // - Sentence complexity measures
  // - Information theory metrics
  
  // Simplified approach for demonstration:
  
  // Remove very common words
  const stopWords = [
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'with', 'about', 'from', 'by', 'is', 'was', 'were', 'be', 'been',
  ];
  
  const words = content.toLowerCase().split(/\s+/);
  const meaningfulWords = words.filter(word => 
    word.length > 2 && !stopWords.includes(word)
  );
  
  // Calculate ratio of meaningful words to total words
  return words.length > 0 ? meaningfulWords.length / words.length : 0;
}

/**
 * Calculate the relevance of content to the scraping goal
 */
function calculateRelevance(content: string, scrapingGoal: string): number {
  // In a real implementation, this would use NLP techniques like:
  // - Semantic similarity
  // - Topic modeling
  // - Entity matching
  
  // Simplified approach for demonstration:
  
  // Extract keywords from scraping goal
  const goalKeywords = scrapingGoal
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  // Count how many goal keywords appear in the content
  let matchCount = 0;
  for (const keyword of goalKeywords) {
    if (content.toLowerCase().includes(keyword)) {
      matchCount++;
    }
  }
  
  // Calculate relevance based on keyword matches
  return goalKeywords.length > 0 ? matchCount / goalKeywords.length : 0;
}

/**
 * Calculate how unique this content is compared to already extracted content
 */
function calculateUniqueness(content: string, state: ScraperAgentState): number {
  // In a real implementation, this would use techniques like:
  // - Jaccard similarity
  // - Cosine similarity of embeddings
  // - Levenshtein distance
  
  // Simplified approach for demonstration:
  
  // If no content has been extracted yet, this content is fully unique
  if (state.extractedContent.size === 0) {
    return 1;
  }
  
  // Calculate average similarity to already extracted content
  let totalSimilarity = 0;
  
  for (const [, pageContent] of state.extractedContent) {
    const similarity = calculateTextSimilarity(content, pageContent.content);
    totalSimilarity += similarity;
  }
  
  const averageSimilarity = totalSimilarity / state.extractedContent.size;
  
  // Return uniqueness (inverse of similarity)
  return 1 - averageSimilarity;
}

/**
 * Calculate simple text similarity between two strings
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  // Split into words and create sets
  const words1 = new Set(
    text1.toLowerCase().split(/\s+/).filter(word => word.length > 3)
  );
  const words2 = new Set(
    text2.toLowerCase().split(/\s+/).filter(word => word.length > 3)
  );
  
  // Calculate Jaccard similarity coefficient
  const intersection = new Set(
    [...words1].filter(word => words2.has(word))
  );
  
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
} 