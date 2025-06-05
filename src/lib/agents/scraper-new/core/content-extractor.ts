/**
 * Content Extractor Module
 * 
 * This module extracts valuable content from web pages,
 * focusing on high-value elements while ignoring navigation, ads, etc.
 */

import type { ExtendedScraperAgentState } from '../state';
import { JSDOM } from 'jsdom';

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
  state: ExtendedScraperAgentState
): Promise<ExtractionResult> {
  const startTime = Date.now();
  console.log(`🔍 [ContentExtractor] Starting content extraction for ${url}`);
  console.log(`📊 [ContentExtractor] HTML length: ${html.length} bytes`);
  
  if (!html || html.length === 0) {
    console.error(`❌ [ContentExtractor] Received empty HTML for ${url}`);
    return {
      title: 'Empty Page',
      content: '',
      contentType: 'text/html',
      metrics: { informationDensity: 0, relevance: 0, uniqueness: 0 }
    };
  }
  
  // Extract title
  console.time('TitleExtraction');
  const title = extractTitle(html);
  console.timeEnd('TitleExtraction');
  console.log(`📑 [ContentExtractor] Extracted title: "${title}"`);
  
  // Extract main content, removing boilerplate, navigation, ads, etc.
  console.log(`🔎 [ContentExtractor] Extracting main content...`);
  console.time('MainContentExtraction');
  const mainContent = extractMainContent(html);
  console.timeEnd('MainContentExtraction');
  console.log(`📏 [ContentExtractor] Extracted content length: ${mainContent.length} bytes`);
  console.log(`📄 [ContentExtractor] First 100 chars: ${mainContent.substring(0, 100).replace(/\n/g, ' ')}...`);
  
  // Calculate metrics about the extracted content
  console.log(`📊 [ContentExtractor] Calculating content metrics...`);
  console.time('MetricsCalculation');
  const metrics = calculateContentMetrics(mainContent, state);
  console.timeEnd('MetricsCalculation');
  console.log(`📈 [ContentExtractor] Metrics:`, metrics);
  
  // Log extraction result summary
  const endTime = Date.now();
  console.log(`✅ [ContentExtractor] Content extraction completed for ${url} in ${endTime - startTime}ms`);
  console.log(`📋 [ContentExtractor] Result: title="${title}", contentLength=${mainContent.length}`);
  
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
  const startTime = Date.now();
  // Simple regex to extract title
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const result = titleMatch ? titleMatch[1] : 'Untitled Page';
  console.log(`🔍 [ContentExtractor] Title extraction: ${result === 'Untitled Page' ? 'No title found' : `Found "${result}"`} in ${Date.now() - startTime}ms`);
  return result;
}

/**
 * Extract the main content from HTML, removing navigation, ads, etc.
 */
function extractMainContent(html: string): string {
  // In a real implementation, this would use more sophisticated approaches:
  // 1. DOM-based content extraction
  // 2. Readability algorithms (like what browsers use for "reader mode")
  // 3. ML-based content extraction
  
  console.log(`🔍 [ContentExtractor] Processing HTML with DOM-based extraction`);
  const startTime = Date.now();
  
  // Create a DOM parser using JSDOM to better handle the HTML
  console.time('DOMParsing');
  let doc;
  try {
    const dom = new JSDOM(html);
    doc = dom.window.document;
    console.log(`✅ [ContentExtractor] Successfully parsed HTML with JSDOM`);
  } catch (error) {
    console.error(`❌ [ContentExtractor] Error parsing HTML with JSDOM: ${error}`);
    return cleanHtml(html); // Fallback to basic cleaning if DOM parsing fails
  }
  console.timeEnd('DOMParsing');
  
  // Remove common non-content elements
  console.log(`🗑️ [ContentExtractor] Cleaning document structure...`);
  console.time('DocumentCleaning');
  
  // Remove header, nav, footer, etc.
  const elementsBefore = doc.querySelectorAll('*').length;
  ['header', 'nav', 'footer', 'aside', 'script', 'style', 'iframe', 'noscript'].forEach(tag => {
    const elements = doc.querySelectorAll(tag);
    console.log(`🧹 [ContentExtractor] Removing ${elements.length} ${tag} elements`);
    elements.forEach((el: Element) => el.parentNode?.removeChild(el));
  });
  
  // Also remove elements likely to be ads or tracking
  const adElements = doc.querySelectorAll('[id*="banner"], [class*="banner"], [id*="ad-"], [class*="ad-"], [id*="cookie"], [class*="cookie"]');
  console.log(`🧹 [ContentExtractor] Removing ${adElements.length} ad/banner/cookie elements`);
  adElements.forEach((el: Element) => el.parentNode?.removeChild(el));
  
  const elementsAfter = doc.querySelectorAll('*').length;
  console.log(`📊 [ContentExtractor] Document cleaning removed ${elementsBefore - elementsAfter} elements (${((elementsBefore - elementsAfter) / elementsBefore * 100).toFixed(1)}%)`);
  console.timeEnd('DocumentCleaning');
  
  console.log(`🔍 [ContentExtractor] Looking for main content area...`);
  console.time('ContentSelection');
  
  // Expanded list of content selectors to try
  const contentSelectors = [
    // Primary content containers
    'main', 
    'article',
    'div#content',
    'div.content',
    
    // Additional content selectors for better coverage
    '.main-content',
    '#main-content',
    '.post-content',
    '.entry-content',
    '[role="main"]',
    '.page-content',
    '.site-content',
    'section.content',
    '.article-body',
    '#article-body'
  ];
  
  // Try each selector
  let contentElement = null;
  for (const selector of contentSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      console.log(`✅ [ContentExtractor] Found content using selector: ${selector}`);
      contentElement = element;
      break;
    }
  }
  console.timeEnd('ContentSelection');
  
  // If no content element found using selectors, try text density analysis
  if (!contentElement) {
    console.log('🔍 [ContentExtractor] Using text density analysis to find content');
    console.time('TextDensityAnalysis');
    contentElement = findContentByTextDensity(doc);
    console.timeEnd('TextDensityAnalysis');
    if (contentElement) {
      console.log('✅ [ContentExtractor] Found content using text density analysis');
    }
  }
  
  // If content element found, extract its HTML
  let contentHtml = '';
  console.time('HTMLExtraction');
  if (contentElement) {
    // Get the HTML content
    contentHtml = contentElement.innerHTML;
    console.log(`📊 [ContentExtractor] Raw content size: ${contentHtml.length} bytes`);
  } else {
    console.log(`❌ [ContentExtractor] No content element found through selectors or density analysis`);
    
    // Fallback: just return the body content
    const bodyElement = doc.querySelector('body');
    if (bodyElement) {
      console.log(`⚠️ [ContentExtractor] Using body content as fallback`);
      contentHtml = bodyElement.innerHTML;
    } else {
      console.log(`❌ [ContentExtractor] No body element found!`);
      contentHtml = html;
    }
  }
  console.timeEnd('HTMLExtraction');
  
  // Clean the HTML
  console.time('HTMLCleaning');
  const cleanedText = cleanHtml(contentHtml);
  console.timeEnd('HTMLCleaning');
  
  const endTime = Date.now();
  console.log(`⏱️ [ContentExtractor] Content extraction completed in ${endTime - startTime}ms`);
  
  return cleanedText;
}

/**
 * Clean HTML content by removing tags and normalizing whitespace
 */
function cleanHtml(html: string): string {
  const startTime = Date.now();
  console.log(`🧹 [ContentExtractor] Cleaning HTML content of ${html.length} bytes`);
  
  // Remove all HTML tags
  console.time('TagRemoval');
  let text = html.replace(/<[^>]*>/g, ' ');
  console.timeEnd('TagRemoval');
  
  // Decode HTML entities
  console.time('EntityDecoding');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  console.timeEnd('EntityDecoding');
  
  // Normalize whitespace
  console.time('WhitespaceNormalization');
  text = text
    .replace(/\s+/g, ' ')
    .trim();
  console.timeEnd('WhitespaceNormalization');
  
  console.log(`🧹 [ContentExtractor] Cleaned text length: ${text.length} bytes (${(text.length / html.length * 100).toFixed(1)}% of original) in ${Date.now() - startTime}ms`);
  return text;
}

/**
 * Calculate metrics about the extracted content
 */
function calculateContentMetrics(
  content: string,
  state: ExtendedScraperAgentState
): {
  informationDensity: number;
  relevance: number;
  uniqueness: number;
} {
  const startTime = Date.now();
  
  // Information density: ratio of meaningful content to total content
  console.time('DensityCalculation');
  const informationDensity = calculateInformationDensity(content);
  console.timeEnd('DensityCalculation');
  console.log(`📊 [ContentExtractor] Information density: ${informationDensity.toFixed(3)}`);
  
  // Relevance: how relevant the content is to the scraping goal
  console.time('RelevanceCalculation');
  const relevance = calculateRelevance(content, state.scrapingGoal);
  console.timeEnd('RelevanceCalculation');
  console.log(`📊 [ContentExtractor] Relevance score: ${relevance.toFixed(3)}`);
  
  // Uniqueness: how unique this content is compared to already extracted content
  console.time('UniquenessCalculation');
  const uniqueness = calculateUniqueness(content, state);
  console.timeEnd('UniquenessCalculation');
  console.log(`📊 [ContentExtractor] Uniqueness score: ${uniqueness.toFixed(3)}`);
  
  console.log(`⏱️ [ContentExtractor] Metrics calculation completed in ${Date.now() - startTime}ms`);
  
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
  
  console.log(`📊 [ContentExtractor] Words: total=${words.length}, meaningful=${meaningfulWords.length} (${(meaningfulWords.length / words.length * 100).toFixed(1)}%)`);
  
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
  
  console.log(`🔑 [ContentExtractor] Goal keywords: ${goalKeywords.join(', ')}`);
  
  // Count how many goal keywords appear in the content
  let matchCount = 0;
  for (const keyword of goalKeywords) {
    if (content.toLowerCase().includes(keyword)) {
      matchCount++;
      console.log(`✓ [ContentExtractor] Matched keyword: "${keyword}"`);
    }
  }
  
  console.log(`📊 [ContentExtractor] Keyword matches: ${matchCount}/${goalKeywords.length}`);
  
  // Calculate relevance based on keyword matches
  return goalKeywords.length > 0 ? matchCount / goalKeywords.length : 0;
}

/**
 * Calculate how unique this content is compared to already extracted content
 */
function calculateUniqueness(content: string, state: ExtendedScraperAgentState): number {
  // In a real implementation, this would use techniques like:
  // - Jaccard similarity
  // - Cosine similarity of embeddings
  // - Levenshtein distance
  
  // Simplified approach for demonstration:
  
  // If no content has been extracted yet, this content is fully unique
  if (state.extractedContent.size === 0) {
    console.log(`🆕 [ContentExtractor] First content - uniqueness is 1.0`);
    return 1;
  }
  
  // Calculate average similarity to already extracted content
  let totalSimilarity = 0;
  const similarityScores: number[] = [];
  
  for (const [url, pageContent] of state.extractedContent) {
    const similarity = calculateTextSimilarity(content, pageContent.content);
    similarityScores.push(similarity);
    console.log(`🔄 [ContentExtractor] Similarity to ${url}: ${similarity.toFixed(3)}`);
    totalSimilarity += similarity;
  }
  
  const averageSimilarity = totalSimilarity / state.extractedContent.size;
  console.log(`📊 [ContentExtractor] Average similarity: ${averageSimilarity.toFixed(3)}`);
  
  if (similarityScores.length > 0) {
    const maxSimilarity = Math.max(...similarityScores);
    console.log(`⚠️ [ContentExtractor] Max similarity: ${maxSimilarity.toFixed(3)}`);
    
    if (maxSimilarity > 0.8) {
      console.log(`⚠️ [ContentExtractor] High similarity detected! Content may be duplicate`);
    }
  }
  
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
  
  const similarity = union.size > 0 ? intersection.size / union.size : 0;
  
  return similarity;
}

/**
 * Find the main content element using text density analysis
 */
function findContentByTextDensity(document: Document): Element | null {
  const startTime = Date.now();
  // Get all potential content containers
  const allDivs = Array.from(document.querySelectorAll('div, section'));
  console.log(`🔍 [ContentExtractor] Analyzing ${allDivs.length} div/section elements for content`);
  
  const contentContainers = allDivs
    .filter(el => {
      // Filter out obvious non-content elements
      const isLikelyContent = 
        !el.closest('nav, footer, header, aside') && // Not in navigation/header/footer
        (el.textContent?.length || 0) > 150 &&       // Has substantial text
        el.querySelectorAll('p, h1, h2, h3, li').length > 0; // Has content elements
      
      return isLikelyContent;
    });
  
  console.log(`🔍 [ContentExtractor] Found ${contentContainers.length} potential content containers`);
  
  if (contentContainers.length === 0) return null;
  
  // Find the container with highest text-to-HTML ratio and content elements
  console.time('TextDensityCalculation');
  const containerWithMetrics = contentContainers.map(container => {
    // Calculate text density (text length / HTML length)
    const text = container.textContent || '';
    const html = container.innerHTML;
    const ratio = text.length / (html.length || 1);
    const contentElements = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote').length;
    
    // Use a weighted score approach
    const score = (ratio * 0.7) + (contentElements * 0.01);
    
    return { container, ratio, contentElements, score };
  });
  console.timeEnd('TextDensityCalculation');
  
  // Sort by score
  containerWithMetrics.sort((a, b) => b.score - a.score);
  
  const best = containerWithMetrics[0];
  console.log(`✅ [ContentExtractor] Best content container found: ratio=${best.ratio.toFixed(3)}, elements=${best.contentElements}, score=${best.score.toFixed(3)} in ${Date.now() - startTime}ms`);
  
  return best.container;
} 