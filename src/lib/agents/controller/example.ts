/**
 * Controller Agent Example Usage
 * 
 * This file demonstrates how to use the Controller Agent to orchestrate
 * interactions between specialized agents.
 */
import { ControllerAgent } from './index';

/**
 * Example of using the Controller Agent directly in code
 */
async function controllerAgentExample() {
  try {
    // Create a controller agent instance
    const controller = new ControllerAgent();
    
    // Example 1: Scrape a website
    console.log('\n🔍 Example 1: Simple scraping\n');
    
    const scrapeResult = await controller.processRequest({
      requestType: 'scrape',
      url: 'https://example.com',
      scrapingGoal: 'Get information about the website',
      options: {
        maxPages: 5,
        maxDepth: 2,
        executeJavaScript: true
      }
    });
    
    console.log(`Scrape result: ${scrapeResult.success ? 'Success' : 'Failed'}`);
    if (scrapeResult.success && scrapeResult.result?.scraperResult) {
      console.log(`Pages scraped: ${scrapeResult.result.scraperResult.pages.length}`);
    }
    
    // Example 2: Scrape and process
    console.log('\n🧠 Example 2: Scrape and process\n');
    
    const scrapeAndProcessResult = await controller.processRequest({
      requestType: 'scrape-and-process',
      url: 'https://example.com/blog',
      scrapingGoal: 'Gather information about their products',
      processingGoal: 'Identify key entities and their relationships',
      options: {
        maxPages: 10,
        maxDepth: 2,
        executeJavaScript: true,
        entityTypes: ['Product', 'Feature', 'Price', 'Category']
      }
    });
    
    console.log(`Scrape and process result: ${scrapeAndProcessResult.success ? 'Success' : 'Failed'}`);
    
    if (scrapeAndProcessResult.success && scrapeAndProcessResult.result?.combinedSummary) {
      const summary = scrapeAndProcessResult.result.combinedSummary;
      console.log(`Pages scraped: ${summary.pagesScraped}`);
      console.log(`Entities extracted: ${summary.entitiesExtracted}`);
      console.log(`Relationships discovered: ${summary.relationshipsDiscovered}`);
      
      // Log some of the entities
      if (scrapeAndProcessResult.result.knowledgeResult?.entities.length) {
        console.log('\nSample Entities:');
        const sampleEntities = scrapeAndProcessResult.result.knowledgeResult.entities.slice(0, 3);
        
        sampleEntities.forEach(entity => {
          console.log(`- ${entity.type}: ${entity.name}`);
          console.log(`  Confidence: ${entity.confidence}`);
          console.log(`  Properties: ${JSON.stringify(entity.properties)}`);
        });
      }
      
      // Log some of the relationships
      if (scrapeAndProcessResult.result.knowledgeResult?.relationships.length) {
        console.log('\nSample Relationships:');
        const sampleRelationships = scrapeAndProcessResult.result.knowledgeResult.relationships.slice(0, 3);
        
        sampleRelationships.forEach(rel => {
          console.log(`- ${rel.source} ${rel.type} ${rel.target}`);
          console.log(`  Confidence: ${rel.confidence}`);
          console.log(`  Properties: ${JSON.stringify(rel.properties)}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error in controller example:', error);
  }
}

// Only run the example if this file is executed directly
if (require.main === module) {
  controllerAgentExample().catch(console.error);
}

export { controllerAgentExample }; 