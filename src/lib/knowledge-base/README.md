# Knowledge Base

The Knowledge Base module provides a structured way to store and retrieve entities and relationships. It serves as the foundation for entity and graph search capabilities in the multi-agent RAG system.

## Overview

The Knowledge Base extends the basic vector store to add support for structured knowledge representation. It enables:

- Entity-based search: Find entities by name, type, or semantic similarity
- Relationship discovery: Traverse connections between entities
- Knowledge enrichment: Add structured information to extracted content
- Graph-based retrieval: Find information based on relationships

## Database Schema

The Knowledge Base uses two primary tables:

### Entities Table

```sql
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  sources UUID[] DEFAULT '{}', -- References to documents
  embedding VECTOR(3072), -- Same dimensions as documents for consistency
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Relationships Table

```sql
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## SQL Functions

The Knowledge Base includes specialized SQL functions for efficient querying:

1. **search_entities**: Searches entities by semantic similarity
2. **search_relationships**: Performs graph traversal from starting entities

## Usage

```typescript
import { createKnowledgeBase } from './lib/knowledge-base';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client
const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Create a knowledge base instance
const knowledgeBase = createKnowledgeBase(supabaseClient);

// Search for entities
const personEntities = await knowledgeBase.searchEntities({
  query: "Alan Turing",
  types: ["person"],
  limit: 5
});

// Create a new entity
const newEntity = await knowledgeBase.createEntity({
  name: "Graph Theory",
  type: "concept",
  properties: {
    description: "A mathematical structure consisting of vertices and edges",
    field: "mathematics"
  },
  sources: ["some-document-id"],
  confidence: 0.95
});

// Create a relationship
const relationship = await knowledgeBase.createRelationship({
  sourceId: "entity-id-1",
  targetId: "entity-id-2",
  type: "created",
  properties: {
    year: 1956
  },
  confidence: 0.9
});

// Find relationships
const relationships = await knowledgeBase.searchRelationships({
  startEntityIds: ["entity-id-1"],
  types: ["created", "contributed_to"],
  maxDepth: 2
});
```

## Integration with Retrieval Agent

The Knowledge Base is used by the Retrieval Agent through the Hybrid Search Chain to perform entity and graph searches:

```typescript
import { createHybridSearchChain } from './lib/chains/hybrid-search-chain';
import { createKnowledgeBase } from './lib/knowledge-base';

// Create the knowledge base
const knowledgeBase = createKnowledgeBase(supabaseClient);

// Create the hybrid search chain with knowledge base integration
const hybridSearchChain = createHybridSearchChain({
  vectorStore,
  supabaseClient,
  knowledgeBase
});

// The entity and graph search methods will now be available
const results = await hybridSearchChain.invoke({
  query: "Who invented the computer?",
  methodOptions: {
    entity: { enabled: true, types: ["person", "organization"] },
    graph: { enabled: true, depth: 2 }
  }
});
```

## Knowledge Entity Types

Common entity types used in the system:

- **person**: Human individuals
- **organization**: Companies, institutions, teams
- **concept**: Abstract ideas or theories
- **product**: Physical or digital products
- **technology**: Specific technologies or methods
- **location**: Physical places
- **event**: Time-bound occurrences

## Relationship Types

Common relationship types:

- **created**: Entity created another entity
- **employed_by**: Person employed by organization
- **part_of**: Entity is a component of another entity
- **located_in**: Entity is located in another entity
- **derived_from**: Entity is derived from another entity
- **affiliated_with**: Entity is affiliated with another entity
- **similar_to**: Entity is similar to another entity

## Data Flow

1. The Knowledge Processing Agent extracts entities and relationships from content
2. These are stored in the Knowledge Base
3. The Retrieval Agent queries the Knowledge Base via entity and graph search
4. Results are integrated with vector and keyword search results
5. The combined results provide comprehensive answers to user queries

## Neo4j Implementation

The Knowledge Base can be implemented using either PostgreSQL (via Supabase) or Neo4j, with Neo4j providing better performance for graph operations.

### Neo4j Advantages

- Native graph data model with nodes, relationships, and properties
- Highly optimized for traversal operations and pattern matching
- Cypher query language designed specifically for graph operations
- Built-in graph algorithms for centrality, community detection, pathfinding
- Efficient handling of complex relationship queries across multiple hops

### Using the Neo4j Implementation

```typescript
import { createNeo4jKnowledgeBase } from './lib/knowledge-base/neo4j/exports';
import { createClient } from '@supabase/supabase-js';
import neo4j from 'neo4j-driver';

// Create a Neo4j-based knowledge base
const knowledgeBase = createNeo4jKnowledgeBase({
  uri: 'neo4j://localhost:7687',
  username: 'neo4j',
  password: 'password',
  database: 'neo4j'
});

// Initialize database with required indexes
await knowledgeBase.initialize();

// Create the hybrid search chain with Neo4j knowledge base
const hybridSearchChain = createHybridSearchChain({
  vectorStore,
  supabaseClient,
  knowledgeBase
});

// Search using both entity and graph search capabilities
const results = await hybridSearchChain.invoke({
  query: "What contributions did Alan Turing make to artificial intelligence?",
  methodOptions: {
    entity: { enabled: true, types: ["person"] },
    graph: { enabled: true, depth: 3 }
  }
});
```

### Setup Script

A setup script is provided to initialize a Neo4j database with the required schema and indexes:

```typescript
import { setupNeo4jDatabase, createSampleData } from './lib/knowledge-base/neo4j/setup';
import neo4j from 'neo4j-driver';

// Setup the database
await setupNeo4jDatabase({
  uri: 'neo4j://localhost:7687',
  username: 'neo4j',
  password: 'password'
});

// Create sample data for testing
const driver = neo4j.driver(
  'neo4j://localhost:7687',
  neo4j.auth.basic('neo4j', 'password')
);
await createSampleData(driver);
await driver.close();
```

### Cypher Query Examples

Neo4j uses Cypher, a declarative graph query language. Here are some example queries:

```cypher
// Find all entities of a specific type
MATCH (e:Entity)
WHERE e.type = 'person'
RETURN e

// Find relationships between entities
MATCH (source:Entity {name: 'Alan Turing'})-[r]->(target:Entity)
RETURN source, r, target

// Find paths between entities up to 3 hops away
MATCH path = (source:Entity {name: 'Alan Turing'})-[*1..3]->(target:Entity)
RETURN path

// Find entities with specific properties
MATCH (e:Entity)
WHERE e.properties.birth_year > 1900
RETURN e

// Graph traversal with relationship types
MATCH (source:Entity {name: 'Alan Turing'})-[:CONTRIBUTED_TO|PIONEERED]->(concept:Entity)
RETURN source, concept
``` 