/**
 * Scraper Agent Example Usage
 * 
 * This example demonstrates how to use the Scraper Agent to extract content from websites.
 * The agent handles all the complexity of navigating websites, extracting valuable content,
 * following relevant links, and organizing the information into a structured format.
 */

import { ScraperAgent } from '../lib/agents/scraper';

async function runScraperExample() {
  console.log('Starting scraper agent example...');
  
  // Create a new scraper agent
  const agent = new ScraperAgent();
  
  // Example 1: Basic scraping with a goal
  console.log('\n--- Example 1: Basic Scraping ---');
  try {
    const results = await agent.scrape({
      baseUrl: 'https://example.com',
      scrapingGoal: 'Gather information about what this domain is used for',
      maxPages: 3 // Limit to just a few pages for the example
    });
    
    console.log(`Scraped ${results.pages.length} pages`);
    console.log(`Total content size: ${results.summary.totalContentSize} bytes`);
    console.log(`Execution time: ${results.summary.executionTime} seconds`);
    console.log(`Goal completion estimate: ${(results.summary.goalCompletion * 100).toFixed(1)}%`);
    
    // Display the titles of the scraped pages
    console.log('\nScraped Pages:');
    results.pages.forEach((page, index) => {
      console.log(`${index + 1}. ${page.title} (${page.url})`);
      console.log(`   Content length: ${page.content.length} chars`);
      console.log(`   Links discovered: ${page.links.length}`);
    });
  } catch (error) {
    console.error('Basic scraping failed:', error);
  }
  
  // Example 2: Advanced scraping with filters
  console.log('\n--- Example 2: Advanced Scraping with Filters ---');
  try {
    const detailedResults = await agent.scrape({
      baseUrl: 'https://example.org',
      scrapingGoal: 'Collect information about the organization and its projects',
      maxPages: 5,
      maxDepth: 2,
      includeImages: true,
      filters: {
        mustIncludePatterns: ['about', 'project', 'mission'],
        excludePatterns: ['privacy', 'terms', 'contact']
      }
    });
    
    console.log(`Scraped ${detailedResults.pages.length} pages`);
    console.log(`Total content size: ${detailedResults.summary.totalContentSize} bytes`);
    console.log(`Coverage score: ${(detailedResults.summary.coverageScore * 100).toFixed(1)}%`);
    
    // Display information density and relevance for each page
    console.log('\nContent Quality Metrics:');
    detailedResults.pages.forEach((page, index) => {
      console.log(`${index + 1}. ${page.title}`);
      console.log(`   Information Density: ${(page.metrics.informationDensity * 100).toFixed(1)}%`);
      console.log(`   Relevance to Goal: ${(page.metrics.relevance * 100).toFixed(1)}%`);
      console.log(`   Uniqueness: ${(page.metrics.uniqueness * 100).toFixed(1)}%`);
    });
  } catch (error) {
    console.error('Advanced scraping failed:', error);
  }
  
  // Example 3: Streaming results as they are found
  console.log('\n--- Example 3: Streaming Results ---');
  try {
    console.log('Streaming scrape results as they are processed:');
    
    let pagesProcessed = 0;
    
    await agent.streamScraping(
      {
        baseUrl: 'https://example.com',
        scrapingGoal: 'Find basic information',
        maxPages: 3
      },
      async (event) => {
        // Handle different event types
        switch (event.type) {
          case 'start':
            console.log(`Started scraping ${event.url} with goal: ${event.goal}`);
            break;
            
          case 'page':
            pagesProcessed++;
            console.log(`[${pagesProcessed}] Processed page: ${event.data.title}`);
            console.log(`    URL: ${event.data.url}`);
            console.log(`    Content length: ${event.data.content.length} chars`);
            console.log(`    Found ${event.data.links.length} links`);
            break;
            
          case 'auth':
            console.log(`Authentication required at ${event.request.url}`);
            console.log(`Auth type: ${event.request.authType}`);
            break;
            
          case 'end':
            console.log(`Scraping complete! Processed ${event.output.pages.length} pages in ${event.output.summary.executionTime.toFixed(2)} seconds`);
            break;
            
          case 'error':
            console.error(`Error during scraping: ${event.error}`);
            break;
        }
      }
    );
  } catch (error) {
    console.error('Streaming scraping failed:', error);
  }
}

// Run the example
runScraperExample()
  .then(() => console.log('\nScraper agent examples completed!'))
  .catch(error => console.error('Error running scraper examples:', error)); 