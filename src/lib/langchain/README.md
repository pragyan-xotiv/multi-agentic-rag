# LangChain Integration

This directory contains the core LangChain configuration and utilities for the multi-agentic RAG system.

## Purpose

LangChain provides the foundation for our LLM interactions, offering:

- Unified interface for working with different LLM providers
- Prompt management and templating
- Tools and agents capabilities
- Standardized message and response formats

## Implementation

The main implementation includes:

- `index.ts`: Core LangChain setup, including LLM configuration with proper temperature settings
- Integration with OpenAI models
- Utility functions for creating and configuring LLM instances

## Usage

The LangChain utilities are used throughout the application to:

1. Initialize LLM instances with appropriate settings
2. Format and structure prompts for different use cases
3. Manage the conversation flow
4. Integrate with other components like vectorstores and agents

## Configuration

The LLM is configured to use the OpenAI API with authentication handled through environment variables, and it can be customized with different temperature settings based on the use case:

- Lower temperature (0.3) for more deterministic responses when accuracy is critical
- Higher temperature (0.7) for more creative responses when exploring ideas 