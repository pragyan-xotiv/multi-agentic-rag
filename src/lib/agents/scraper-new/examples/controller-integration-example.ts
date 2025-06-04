/**
 * Example of integrating the non-recursive scraper with the controller
 */

import { executeScraper, streamScraper } from '../controller-integration';
import { ScraperStreamEvent } from '../types';

async function testControllerIntegration() {
  console.log('Testing controller integration...');
  
  // Define scraper options
  const options = {
    baseUrl: 'https://example.com',
    scrapingGoal: 'Extract information about the website',
    maxPages: 3,
    maxDepth: 2
  };
  
  // Test with non-recursive scraper (default)
  console.log('\n=== Testing with non-recursive scraper ===');
  try {
    const result = await executeScraper(options);
    console.log(`Pages scraped: ${result.pages.length}`);
  } catch (error) {
    console.error('Error with non-recursive scraper:', error);
  }
  
  // Test with original scraper
  console.log('\n=== Testing with original scraper ===');
  try {
    const result = await executeScraper(options, { useNonRecursive: false });
    console.log(`Pages scraped: ${result.pages.length}`);
  } catch (error) {
    console.error('Error with original scraper:', error);
  }
  
  // Test streaming with non-recursive scraper
  console.log('\n=== Testing streaming with non-recursive scraper ===');
  try {
    // Create an event handler
    const eventHandler = async (event: ScraperStreamEvent) => {
      if (event.type === 'page') {
        console.log(`Page processed: ${event.data.url}`);
      } else if (event.type === 'end') {
        console.log('Scraping completed!');
      }
    };
    
    // Execute streaming with non-recursive scraper
    const result = await streamScraper(
      { ...options, maxPages: 2 },
      eventHandler
    );
    
    console.log(`Total pages scraped: ${result.pages.length}`);
  } catch (error) {
    console.error('Error with streaming:', error);
  }
  
  console.log('\nController integration test completed!');
}

// Run the example if this file is executed directly
if (require.main === module) {
  testControllerIntegration().catch(console.error);
}

export { testControllerIntegration }; 