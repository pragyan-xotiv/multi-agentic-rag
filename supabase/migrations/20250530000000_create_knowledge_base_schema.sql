-- Create the entities table
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

-- Create the relationships table
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

-- Create indexes for efficient queries
CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_name ON entities(name);
CREATE INDEX idx_relationships_source ON relationships(source_id);
CREATE INDEX idx_relationships_target ON relationships(target_id);
CREATE INDEX idx_relationships_type ON relationships(type);

-- Create a function to search entities by similarity
CREATE OR REPLACE FUNCTION search_entities(
  query_embedding VECTOR(3072),
  entity_types TEXT[] DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  properties JSONB,
  confidence FLOAT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    entities.id,
    entities.name,
    entities.type,
    entities.properties,
    entities.confidence,
    1 - (entities.embedding <=> query_embedding) AS similarity
  FROM entities
  WHERE 
    -- Apply similarity threshold filter
    entities.embedding IS NOT NULL AND
    1 - (entities.embedding <=> query_embedding) > match_threshold
    -- Filter by entity types if provided
    AND CASE
      WHEN entity_types IS NOT NULL THEN 
        entities.type = ANY(entity_types)
      ELSE TRUE
    END
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Create a function for graph traversal (relationship search)
CREATE OR REPLACE FUNCTION search_relationships(
  start_entity_ids UUID[],
  relationship_types TEXT[] DEFAULT NULL,
  max_depth INT DEFAULT 2,
  max_results INT DEFAULT 100
)
RETURNS TABLE (
  source_id UUID,
  target_id UUID,
  relationship_type TEXT,
  properties JSONB,
  confidence FLOAT,
  depth INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE relationship_traversal AS (
    -- Base case: direct relationships from start entities
    SELECT
      r.source_id,
      r.target_id,
      r.type AS relationship_type,
      r.properties,
      r.confidence,
      1 AS depth
    FROM relationships r
    WHERE 
      r.source_id = ANY(start_entity_ids)
      AND CASE
        WHEN relationship_types IS NOT NULL THEN 
          r.type = ANY(relationship_types)
        ELSE TRUE
      END
    
    UNION ALL
    
    -- Recursive case: follow relationships up to max_depth
    SELECT
      r.source_id,
      r.target_id,
      r.type AS relationship_type,
      r.properties,
      r.confidence,
      rt.depth + 1
    FROM relationships r
    JOIN relationship_traversal rt ON r.source_id = rt.target_id
    WHERE 
      rt.depth < max_depth
      AND CASE
        WHEN relationship_types IS NOT NULL THEN 
          r.type = ANY(relationship_types)
        ELSE TRUE
      END
  )
  SELECT * FROM relationship_traversal
  LIMIT max_results;
END;
$$; 