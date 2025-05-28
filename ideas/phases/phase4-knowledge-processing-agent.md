# Phase 4: Knowledge Processing Agent

**Duration: 3-4 weeks**

Implement the Knowledge Processing Agent to transform raw content into structured knowledge.

## Overview

The Knowledge Processing Agent is responsible for transforming raw web content into structured, interconnected knowledge that can be effectively stored and retrieved. This agent uses content-adaptive processing to understand different types of information and extract entities, relationships, and semantic meaning.

## Key Objectives

- Enhance the database schema to support structured knowledge
- Implement the Knowledge Processing Agent with content analysis capabilities
- Create entity extraction and relationship discovery pipelines
- Build a knowledge explorer interface for visualizing the knowledge graph
- Integrate with existing agents to leverage structured knowledge

## Tasks

### 1. Enhanced Database Schema

- Add Entities and Relationships tables
  ```sql
  CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    properties JSONB,
    sources UUID[] REFERENCES documents(id),
    embedding VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  CREATE TABLE relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES entities(id),
    target_id UUID NOT NULL REFERENCES entities(id),
    type TEXT NOT NULL,
    properties JSONB,
    confidence FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  ```

- Implement graph data models
  ```typescript
  class Entity {
    id: string;
    type: string;
    name: string;
    properties: Record<string, any>;
    sources: string[];
    confidence: number;
    embedding?: number[];
    
    // Methods for entity operations
    getRelationships(): Promise<Relationship[]> {
      // Implementation
    }
    
    updateProperty(key: string, value: any): Promise<void> {
      // Implementation
    }
  }
  
  class Relationship {
    id: string;
    sourceId: string;
    targetId: string;
    type: string;
    properties: Record<string, any>;
    confidence: number;
    
    // Methods for relationship operations
    getSource(): Promise<Entity> {
      // Implementation
    }
    
    getTarget(): Promise<Entity> {
      // Implementation
    }
  }
  ```

- Create indexing strategies
  - Set up indexes for efficient entity lookup
  - Create specialized indexes for relationship traversal
  - Implement vector indexes for entity embeddings

### 2. Knowledge Processing Implementation

- Define agent state and workflows
  ```typescript
  interface KnowledgeAgentState {
    rawContent: ScraperOutput;
    processingGoal: string;
    
    contentAnalysis: {
      contentType: string;
      domainSpecific: boolean;
      complexity: number;
      structuredDataTypes: string[];
    };
    
    extractedDocuments: ProcessedDocument[];
    entities: Entity[];
    relationships: Relationship[];
    
    embeddingBatches: DocumentBatch[];
    
    processingMetrics: {
      documentCount: number;
      entityCount: number;
      relationshipCount: number;
      processingStage: string;
      validationScore: number;
    };
    
    structuredKnowledge: KnowledgeOutput;
  }
  
  const knowledgeWorkflow = new StateGraph<KnowledgeAgentState>({
    channels: {
      contentAnalysis: new Channel(),
      extractedEntities: new Channel(),
      relationships: new Channel()
    }
  })
    .addNode("analyzeContent", analyzeContentType)
    .addNode("cleanNormalize", cleanAndNormalizeContent)
    .addNode("extractEntities", identifyEntities)
    .addNode("buildRelationships", discoverRelationships)
    .addNode("createEmbeddings", generateEmbeddings)
    .addNode("indexContent", storeInKnowledgeBase)
    .addNode("validateKnowledge", validateKnowledgeIntegration)
    
    .addEdge("analyzeContent", "cleanNormalize")
    .addEdge("cleanNormalize", "extractEntities")
    .addEdge("extractEntities", "buildRelationships")
    .addEdge("buildRelationships", "createEmbeddings")
    .addEdge("createEmbeddings", "indexContent")
    .addEdge("indexContent", "validateKnowledge")
    .addEdge("validateKnowledge", "FINAL");
  ```

- Implement content analysis
  ```typescript
  async function analyzeContentType(state: KnowledgeAgentState, context: AgentContext): Promise<KnowledgeAgentState> {
    const analysisPrompt = PromptTemplate.fromTemplate(`
      You are an expert content analyst. Analyze this content and determine its characteristics.
      
      CONTENT SAMPLE:
      {contentSample}
      
      Provide a detailed analysis with the following:
      1. Content type (article, product listing, documentation, etc.)
      2. Domain specificity (is this general knowledge or domain-specific?)
      3. Complexity score (0-1)
      4. Main topics covered
      5. Types of structured data present (tables, lists, code blocks, etc.)
      6. Special processing considerations
      
      Format your response as JSON.
    `);
    
    const analysisChain = analysisPrompt.pipe(llm).pipe(JsonOutputParser);
    
    // Select representative samples from raw content
    const contentSample = selectRepresentativeSamples(state.rawContent);
    
    const analysis = await analysisChain.invoke({
      contentSample: contentSample
    });
    
    // Update state with analysis results
    state.contentAnalysis = {
      contentType: analysis.contentType,
      domainSpecific: analysis.domainSpecificity === "domain-specific",
      complexity: analysis.complexityScore,
      structuredDataTypes: analysis.structuredDataTypes
    };
    
    return state;
  }
  ```

- Create entity extraction pipeline
  ```typescript
  async function identifyEntities(state: KnowledgeAgentState, context: AgentContext): Promise<KnowledgeAgentState> {
    // Adapt entity extraction based on content type
    let entityExtractionPrompt;
    
    if (state.contentAnalysis.domainSpecific) {
      // For domain-specific content, use specialized extraction
      entityExtractionPrompt = createDomainSpecificEntityPrompt(state);
    } else {
      // For general content, use standard extraction
      entityExtractionPrompt = createGeneralEntityPrompt();
    }
    
    // Process documents in batches
    const entities: Entity[] = [];
    
    for (const doc of state.extractedDocuments) {
      const extractedEntities = await extractEntitiesFromDocument(
        doc, 
        entityExtractionPrompt,
        llm
      );
      
      entities.push(...extractedEntities);
    }
    
    // Deduplicate entities
    state.entities = deduplicateEntities(entities);
    
    return state;
  }
  ```

- Build relationship discovery system
  ```typescript
  async function discoverRelationships(state: KnowledgeAgentState, context: AgentContext): Promise<KnowledgeAgentState> {
    const relationships: Relationship[] = [];
    
    // First pass: extract explicit relationships from text
    for (const doc of state.extractedDocuments) {
      const explicitRelationships = await extractExplicitRelationships(
        doc,
        state.entities,
        llm
      );
      
      relationships.push(...explicitRelationships);
    }
    
    // Second pass: infer relationships between co-occurring entities
    const inferredRelationships = await inferEntityRelationships(
      state.entities,
      state.extractedDocuments,
      llm
    );
    
    relationships.push(...inferredRelationships);
    
    // Third pass: use knowledge graph completion techniques
    const completedRelationships = await completeKnowledgeGraph(
      state.entities,
      relationships,
      llm
    );
    
    relationships.push(...completedRelationships);
    
    // Deduplicate and score relationships
    state.relationships = scoreAndDeduplicateRelationships(relationships);
    
    return state;
  }
  ```

### 3. Knowledge Base Management

- Create knowledge indexing system
  - Implement chunking strategies based on content type
  - Create metadata enrichment pipeline
  - Build document-entity linking system

- Implement chunking strategies
  ```typescript
  function chunkDocument(document: ProcessedDocument, contentType: string): DocumentChunk[] {
    // Select chunking strategy based on content type
    if (contentType === 'article') {
      return semanticChunking(document);
    } else if (contentType === 'documentation') {
      return hierarchicalChunking(document);
    } else if (contentType === 'conversation') {
      return dialogueChunking(document);
    } else {
      return standardChunking(document);
    }
  }
  ```

- Build metadata extraction
  - Extract document metadata (author, date, source, etc.)
  - Create content classification system
  - Implement keyword and topic extraction

- Add validation mechanisms
  ```typescript
  async function validateKnowledgeIntegration(state: KnowledgeAgentState, context: AgentContext): Promise<KnowledgeAgentState> {
    // Validate entity quality
    const entityQualityScore = evaluateEntityQuality(state.entities);
    
    // Validate relationship coherence
    const relationshipCoherenceScore = evaluateRelationshipCoherence(
      state.entities,
      state.relationships
    );
    
    // Validate coverage of original content
    const coverageScore = evaluateContentCoverage(
      state.rawContent,
      state.entities,
      state.relationships
    );
    
    // Generate overall validation score
    state.processingMetrics.validationScore = calculateOverallValidationScore(
      entityQualityScore,
      relationshipCoherenceScore,
      coverageScore
    );
    
    // If validation score is too low, flag for human review
    if (state.processingMetrics.validationScore < 0.7) {
      // Flag for human review
      await flagForHumanReview(state);
    }
    
    return state;
  }
  ```

### 4. Knowledge Explorer UI

- Create visualization for knowledge graph
  ```jsx
  // app/knowledge/explorer/page.tsx
  export default function KnowledgeExplorerPage() {
    const [entities, setEntities] = useState<Entity[]>([]);
    const [relationships, setRelationships] = useState<Relationship[]>([]);
    const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
      // Fetch initial entities and relationships
      fetchKnowledgeGraph();
    }, []);
    
    async function fetchKnowledgeGraph() {
      setLoading(true);
      try {
        const response = await fetch('/api/knowledge/graph');
        const data = await response.json();
        setEntities(data.entities);
        setRelationships(data.relationships);
      } catch (error) {
        console.error('Error fetching knowledge graph:', error);
      } finally {
        setLoading(false);
      }
    }
    
    // Render knowledge graph visualization using D3 or similar
    
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Knowledge Explorer</h1>
        
        {/* Graph visualization component */}
        <div className="border rounded-lg p-4 h-96 mb-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p>Loading knowledge graph...</p>
            </div>
          ) : (
            <KnowledgeGraphVisualization 
              entities={entities}
              relationships={relationships}
              onEntityClick={setSelectedEntity}
            />
          )}
        </div>
        
        {/* Entity details panel */}
        {selectedEntity && (
          <div className="border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">{selectedEntity.name}</h2>
            <p className="text-sm text-gray-500 mb-4">Type: {selectedEntity.type}</p>
            
            {/* Entity properties */}
            {Object.entries(selectedEntity.properties).map(([key, value]) => (
              <div key={key} className="mb-2">
                <span className="font-medium">{key}:</span> {value.toString()}
              </div>
            ))}
            
            {/* Related entities */}
            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">Related Entities</h3>
              <EntityRelationshipList 
                entityId={selectedEntity.id}
                relationships={relationships}
                entities={entities}
                onEntityClick={setSelectedEntity}
              />
            </div>
          </div>
        )}
      </div>
    );
  }
  ```

- Implement entity browsing interface
  - Create entity search and filtering
  - Build entity detail views
  - Implement entity editing capabilities

- Build relationship explorer
  - Create relationship visualization components
  - Implement path finding between entities
  - Build relationship filtering and search

### 5. Integration with Existing Agents

- Connect Knowledge Processing with Query and Retrieval agents
  - Create interfaces for agent communication
  - Implement knowledge update notifications
  - Build query enhancements using structured knowledge

- Update retrieval strategies to use structured knowledge
  ```typescript
  async function enhancedRetrieval(query: string, options: RetrievalOptions): Promise<RetrievalResult> {
    // Extract entities from query
    const queryEntities = await extractEntitiesFromQuery(query);
    
    // Retrieve directly referenced entities
    const directEntityResults = await retrieveDirectEntities(queryEntities);
    
    // Retrieve related entities through graph traversal
    const relatedEntityResults = await retrieveRelatedEntities(directEntityResults);
    
    // Perform vector search for semantic matching
    const vectorResults = await performVectorSearch(query);
    
    // Combine and rank results
    const combinedResults = mergeAndRankResults(
      directEntityResults,
      relatedEntityResults,
      vectorResults
    );
    
    return {
      chunks: combinedResults.chunks,
      entities: combinedResults.entities,
      relationships: combinedResults.relationships
    };
  }
  ```

## Deliverables

- Enhanced database schema for structured knowledge
- Fully functional Knowledge Processing Agent
- Entity extraction and relationship discovery pipelines
- Knowledge Explorer UI for visualizing the knowledge graph
- Integration with Query and Retrieval agents

## Success Criteria

- Raw content is successfully transformed into structured knowledge
- Entities and relationships are accurately extracted and stored
- Knowledge Explorer UI provides intuitive visualization of the knowledge graph
- Retrieval capabilities are enhanced with structured knowledge
- System is ready for implementing the Scraper Agent in Phase 5 