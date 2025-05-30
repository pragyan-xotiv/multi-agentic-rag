/**
 * Navigation Decision Module
 * 
 * This module evaluates scraping progress and decides on the next action:
 * - Whether to continue scraping or stop (goal completion)
 * - Which URL to visit next from the priority queue
 * - Whether to adjust scraping parameters based on findings
 */

import type { ScraperAgentState } from '../types';

interface NavigationDecision {
  action: 'continue' | 'complete';
  nextUrl?: string;
  completionEstimate: number;
  reason: string;
}

interface ProgressMetrics {
  informationDensity: number;
  relevance: number;
  uniqueness: number;
  completeness: number;
}

/**
 * Evaluate scraping progress and decide next action
 */
export async function evaluateProgress(
  state: ScraperAgentState
): Promise<ProgressMetrics> {
  // Calculate the information density across all scraped content
  const informationDensity = calculateInformationDensity(state);
  
  // Calculate the relevance of scraped content to the goal
  const relevance = calculateRelevance(state);
  
  // Calculate the uniqueness of the information gathered
  const uniqueness = calculateUniqueness(state);
  
  // Estimate the completeness of information relative to the goal
  const completeness = calculateCompleteness(state);
  
  // Update the state with the new metrics
  state.valueMetrics = {
    informationDensity,
    relevance,
    uniqueness,
    completeness
  };
  
  return state.valueMetrics;
}

/**
 * Decide the next action based on the current state and progress metrics
 */
export async function decideNextAction(
  state: ScraperAgentState
): Promise<NavigationDecision> {
  // Check if we've reached the maximum number of pages
  if (state.visitedUrls.size >= state.maxPages) {
    return {
      action: 'complete',
      completionEstimate: state.valueMetrics.completeness,
      reason: 'Maximum page limit reached'
    };
  }
  
  // Check if we've gathered enough information
  if (state.valueMetrics.completeness > 0.85) {
    return {
      action: 'complete',
      completionEstimate: state.valueMetrics.completeness,
      reason: 'Sufficient information gathered for the goal'
    };
  }
  
  // Check if we're finding diminishing returns
  if (
    state.valueMetrics.uniqueness < 0.2 && 
    state.visitedUrls.size > 10
  ) {
    return {
      action: 'complete',
      completionEstimate: state.valueMetrics.completeness,
      reason: 'Diminishing returns in information uniqueness'
    };
  }
  
  // If we should continue, get the next URL from the priority queue
  if (state.pageQueue.isEmpty()) {
    return {
      action: 'complete',
      completionEstimate: state.valueMetrics.completeness,
      reason: 'No more URLs in the queue'
    };
  }
  
  // Get the next URL from the priority queue
  const nextItem = state.pageQueue.dequeue();
  
  if (!nextItem) {
    return {
      action: 'complete',
      completionEstimate: state.valueMetrics.completeness,
      reason: 'No more URLs in the queue'
    };
  }
  
  return {
    action: 'continue',
    nextUrl: nextItem.url,
    completionEstimate: state.valueMetrics.completeness,
    reason: `Selected next URL with expected value: ${nextItem.expectedValue.toFixed(2)}`
  };
}

/**
 * Calculate the information density across all scraped content
 */
function calculateInformationDensity(state: ScraperAgentState): number {
  if (state.extractedContent.size === 0) {
    return 0;
  }
  
  // Calculate the average information density of all pages
  let totalDensity = 0;
  
  for (const [, pageContent] of state.extractedContent) {
    totalDensity += pageContent.metrics.informationDensity;
  }
  
  return totalDensity / state.extractedContent.size;
}

/**
 * Calculate the relevance of scraped content to the goal
 */
function calculateRelevance(state: ScraperAgentState): number {
  if (state.extractedContent.size === 0) {
    return 0;
  }
  
  // Calculate the average relevance of all pages
  let totalRelevance = 0;
  
  for (const [, pageContent] of state.extractedContent) {
    totalRelevance += pageContent.metrics.relevance;
  }
  
  return totalRelevance / state.extractedContent.size;
}

/**
 * Calculate the uniqueness of the information gathered
 */
function calculateUniqueness(state: ScraperAgentState): number {
  if (state.extractedContent.size <= 1) {
    return 1; // First page is always fully unique
  }
  
  // Calculate the average uniqueness of all pages
  let totalUniqueness = 0;
  
  for (const [, pageContent] of state.extractedContent) {
    totalUniqueness += pageContent.metrics.uniqueness;
  }
  
  return totalUniqueness / state.extractedContent.size;
}

/**
 * Estimate the completeness of information relative to the goal
 */
function calculateCompleteness(state: ScraperAgentState): number {
  // This is a complex estimation that would depend on various factors:
  // 1. The specificity of the goal
  // 2. The amount and quality of information gathered
  // 3. The diminishing returns of new information
  // 4. The coverage of relevant subtopics
  
  // Simplified approach for demonstration:
  
  // No pages scraped yet
  if (state.extractedContent.size === 0) {
    return 0;
  }
  
  // Calculate the base completeness using a logarithmic curve
  // This simulates diminishing returns as more pages are scraped
  const pagesScraped = state.extractedContent.size;
  const logBase = 1.5;
  const logScaledPages = Math.log(pagesScraped + 1) / Math.log(logBase);
  const maxScaledPages = Math.log(state.maxPages + 1) / Math.log(logBase);
  
  // Base completion is the ratio of log-scaled pages to max log-scaled pages
  const baseCompletion = logScaledPages / maxScaledPages;
  
  // Adjust completeness based on relevance and information density
  const qualityMultiplier = 
    (state.valueMetrics.relevance + state.valueMetrics.informationDensity) / 2;
  
  // Combine the base completion with the quality multiplier
  const weightedCompletion = baseCompletion * qualityMultiplier;
  
  // Ensure the result is between 0 and 1
  return Math.max(0, Math.min(1, weightedCompletion));
} 