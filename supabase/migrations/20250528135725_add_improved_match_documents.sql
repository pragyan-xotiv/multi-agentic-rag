-- Create an improved match_documents function with filter support
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(3072),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5,
  filter JSONB DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_variable
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE
    -- Apply similarity threshold filter
    1 - (documents.embedding <=> query_embedding) > match_threshold
    -- Filter by specific IDs if provided
    AND CASE
      WHEN filter->>'ids' IS NOT NULL THEN 
        id = ANY (SELECT jsonb_array_elements_text(filter->'ids')::UUID)
      ELSE TRUE
    END
    -- Filter by metadata if provided
    AND CASE
      WHEN filter->>'metadata' IS NOT NULL THEN 
        documents.metadata @> filter->'metadata'
      ELSE TRUE
    END
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
