/**
 * Simple example of using the non-recursive scraper agent
 */

import { ScraperAgent, ScraperStreamEvent } from '../index';

async function runExample() {
  // Create a new scraper agent
  const scraper = new ScraperAgent();
  
  // Define options
  const options = {
    baseUrl: 'https://example.com',
    scrapingGoal: 'Extract information about the website',
    maxPages: 5,
    maxDepth: 2,
    executeJavaScript: true,
    onEvent: async (event: ScraperStreamEvent) => {
      console.log(`Event received: ${event.type}`);
      
      if (event.type === 'page') {
        console.log(`Page processed: ${event.data.url}`);
        console.log(`Title: ${event.data.title}`);
        console.log(`Content length: ${event.data.content.length} chars`);
        console.log(`Links found: ${event.data.links.length}`);
      }
    }
  };
  
  try {
    // Execute the scraper
    console.log('Starting scraper...');
    const result = await scraper.scrape(options);
    
    // Log the results
    console.log('Scraping completed!');
    console.log(`Pages scraped: ${result.pages.length}`);
    console.log(`Total content size: ${result.summary.totalContentSize} chars`);
    console.log(`Execution time: ${result.summary.executionTime}ms`);
    
    // Print information about each page
    result.pages.forEach((page, index) => {
      console.log(`\nPage ${index + 1}: ${page.url}`);
      console.log(`Title: ${page.title}`);
      console.log(`Content type: ${page.contentType}`);
      console.log(`Content length: ${page.content.length} chars`);
      console.log(`Links: ${page.links.length}`);
      console.log(`Metrics: relevance=${page.metrics.relevance.toFixed(2)}, density=${page.metrics.informationDensity.toFixed(2)}`);
    });
  } catch (error) {
    console.error('Error running scraper:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runExample().catch(console.error);
}

export { runExample }; 