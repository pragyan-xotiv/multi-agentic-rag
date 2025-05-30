/**
 * Neo4j Configuration
 * 
 * This file contains configuration settings for connecting to Neo4j.
 * In a production environment, these should be loaded from environment variables.
 */

/**
 * Configuration interface for Neo4j connection
 */
export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
}

/**
 * Get Neo4j configuration from environment variables
 */
export function getNeo4jConfig(): Neo4jConfig {
  return {
    uri: process.env.NEO4J_URI || 'neo4j://localhost:7687',
    username: process.env.NEO4J_USERNAME || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password',
    database: process.env.NEO4J_DATABASE || 'neo4j'
  };
} 