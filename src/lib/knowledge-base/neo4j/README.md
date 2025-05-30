# Neo4j Knowledge Base

This directory contains a Neo4j implementation of the Knowledge Base interface, providing graph database capabilities for entity and relationship storage and retrieval.

## Features

- Optimized graph traversal and pattern matching with Cypher
- Vector search capabilities for semantic entity retrieval
- Efficient multi-hop relationship queries
- Full CRUD operations for entities and relationships
- Flexible property storage for both entities and relationships

## Getting Started

### 1. Start Neo4j with Docker Compose

```bash
# Start the Neo4j container
docker-compose -f docker-compose.neo4j.yml up -d

# Check container status
docker-compose -f docker-compose.neo4j.yml ps
```

### 2. Access Neo4j Browser

Once Neo4j is running, you can access the Neo4j Browser interface at:

```
http://localhost:7474
```

Default credentials:
- Username: neo4j
- Password: password

### 3. Initialize the Database

Run the setup script to create necessary indexes and constraints:

```typescript
import { setupNeo4jDatabase } from './lib/knowledge-base/neo4j/setup';

await setupNeo4jDatabase({
  uri: 'neo4j://localhost:7687',
  username: 'neo4j',
  password: 'password'
});
```

### 4. Create and Use the Knowledge Base

```typescript
import { createNeo4jKnowledgeBase } from './lib/knowledge-base/neo4j/exports';

const knowledgeBase = createNeo4jKnowledgeBase({
  uri: 'neo4j://localhost:7687',
  username: 'neo4j',
  password: 'password',
  database: 'neo4j'
});

// Search for entities
const results = await knowledgeBase.searchEntities({
  query: 'Alan Turing',
  types: ['person'],
  useEmbedding: true
});

// Search for relationships
const relationships = await knowledgeBase.searchRelationships({
  startEntityIds: ['person-1'],
  maxDepth: 2
});
```

## File Structure

- `config.ts` - Configuration settings and Cypher queries
- `index.ts` - Main implementation of the Knowledge Base interface
- `langchain.ts` - LangChain-based implementation with Neo4jVectorStore
- `exports.ts` - Convenient exports for external use
- `setup.ts` - Database initialization and sample data creation

## Implementation Options

This package provides two different implementations of the Neo4j Knowledge Base:

### 1. Standard Implementation (index.ts)

The standard implementation uses the Neo4j driver directly for all operations, with custom Cypher queries and manual handling of embeddings.

```typescript
import { createNeo4jKnowledgeBase } from './lib/knowledge-base/neo4j/exports';

const knowledgeBase = createNeo4jKnowledgeBase({
  uri: 'neo4j://localhost:7687',
  username: 'neo4j',
  password: 'password',
  database: 'neo4j'
});

await knowledgeBase.initialize();
```

### 2. LangChain Implementation (langchain.ts)

The LangChain implementation leverages `Neo4jVectorStore` from LangChain's community package for vector operations, providing better integration with the LangChain ecosystem.

```typescript
import { createLangChainNeo4jKnowledgeBase } from './lib/knowledge-base/neo4j/exports';
import { OpenAIEmbeddings } from "@langchain/openai";

// Using custom embeddings
const embeddings = new OpenAIEmbeddings();
const knowledgeBase = createLangChainNeo4jKnowledgeBase(
  {
    uri: 'neo4j://localhost:7687',
    username: 'neo4j',
    password: 'password',
    database: 'neo4j'
  },
  embeddings
);

// Or using default embeddings
const knowledgeBase = createLangChainNeo4jKnowledgeBase({
  uri: 'neo4j://localhost:7687',
  username: 'neo4j',
  password: 'password',
  database: 'neo4j'
});

await knowledgeBase.initialize();
```

## LangChain Benefits

The LangChain implementation offers several advantages:

1. **Simplified Vector Operations**: Uses Neo4jVectorStore for vector embeddings and similarity search
2. **Document-based Integration**: Uses LangChain's Document format for storing entity metadata
3. **Embeddings Flexibility**: Works with any LangChain-compatible embedding provider
4. **Future Compatibility**: Better integration with other LangChain components and chains

Both implementations fully support the Knowledge Base interface, so you can choose the one that best fits your requirements.

## Understanding the Graph Model

### Nodes (Entities)

Entities are stored as nodes with the label `Entity` and properties including:

- `id` - Unique identifier
- `name` - Display name
- `type` - Entity type (e.g., 'person', 'organization', 'concept')
- `properties` - JSON object with additional attributes
- `sources` - Array of source references
- `confidence` - Confidence score (0-1)
- `embedding` - Vector representation for semantic search

### Relationships

Relationships connect entities and include:

- `id` - Unique identifier
- Custom relationship type (e.g., 'CREATED', 'WORKS_FOR', 'LOCATED_IN')
- `properties` - JSON object with relationship attributes
- `confidence` - Confidence score (0-1)

## Example Cypher Queries

Find all entities of type 'person':

```cypher
MATCH (e:Entity)
WHERE e.type = 'person'
RETURN e
```

Find relationships between two entities:

```cypher
MATCH path = (source:Entity {name: 'Alan Turing'})-[*1..3]->(target:Entity {name: 'Artificial Intelligence'})
RETURN path
```

## Performance Considerations

- The implementation creates indexes on commonly queried properties
- For large graphs, consider adjusting the Neo4j memory settings in docker-compose.yml
- Vector search uses Neo4j's built-in vector index functionality
- Graph traversal depth is limited to prevent overly expensive queries 