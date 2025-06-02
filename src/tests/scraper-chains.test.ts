import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunnableSequence } from '@langchain/core/runnables';

// Mock ChatOpenAI to prevent actual API calls
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({
      content: 'Mocked response from OpenAI'
    })
  }))
}));

// Import the chain modules
import { runURLAnalysisChain } from '../lib/chains/url-analysis-chain';
import { runAuthenticationDetectionChain } from '../lib/chains/authentication-detection-chain';
import { runContentExtractionChain } from '../lib/chains/content-extraction-chain';
import { runLinkDiscoveryChain } from '../lib/chains/link-discovery-chain';
import { runProgressEvaluationChain } from '../lib/chains/progress-evaluation-chain';
import { runNavigationDecisionChain } from '../lib/chains/navigation-decision-chain';

// Import core modules we need to mock
import * as urlAnalyzer from '../lib/agents/scraper/core/url-analyzer';
import * as authHandler from '../lib/agents/scraper/core/auth-handler';
import * as contentExtractor from '../lib/agents/scraper/core/content-extractor';
import * as linkPrioritizer from '../lib/agents/scraper/core/link-prioritizer';
import * as navigationDecision from '../lib/agents/scraper/core/navigation-decision';

// Mock the RunnableSequence
vi.mock('@langchain/core/runnables', () => ({
  RunnableSequence: {
    from: vi.fn().mockImplementation(() => ({
      invoke: vi.fn().mockResolvedValue({
        relevanceScore: 0.8,
        expectedValue: 0.7,
        rationale: 'This seems relevant to the goal',
        linkEvaluations: [
          {
            url: 'https://example.com/about',
            valueScore: 0.8,
            relevance: 0.9,
            explanation: 'About page likely contains valuable information'
          }
        ]
      })
    }))
  }
}));

// Mock the core modules
vi.mock('../lib/agents/scraper/core/url-analyzer', () => ({
  analyzeUrl: vi.fn().mockResolvedValue({
    domainAuthority: 0.7,
    isAllowedByRobots: true,
    wasVisitedBefore: false
  })
}));

vi.mock('../lib/agents/scraper/core/auth-handler', () => ({
  detectAuthRequirements: vi.fn().mockResolvedValue({
    authType: 'none',
    loginUrl: null,
    formFields: []
  }),
  createAuthRequest: vi.fn().mockResolvedValue({
    url: 'https://example.com/login',
    authType: 'form',
    formFields: ['username', 'password'],
    callbackUrl: 'https://example.com',
    sessionToken: '12345',
    authPortalUrl: 'https://auth.example.com'
  })
}));

vi.mock('../lib/agents/scraper/core/content-extractor', () => ({
  extractContent: vi.fn().mockResolvedValue({
    title: 'Example Domain',
    content: 'This domain is for use in illustrative examples in documents.',
    contentType: 'text/html'
  })
}));

vi.mock('../lib/agents/scraper/core/link-prioritizer', () => ({
  identifyLinks: vi.fn().mockResolvedValue([
    {
      url: 'https://example.com/about',
      text: 'About',
      context: 'About link',
      predictedValue: 0.8
    }
  ])
}));

vi.mock('../lib/agents/scraper/core/navigation-decision', () => ({
  evaluateProgress: vi.fn().mockResolvedValue({
    informationDensity: 0.7,
    relevance: 0.8,
    uniqueness: 0.9
  }),
  decideNextAction: vi.fn().mockResolvedValue({
    action: 'continue',
    nextUrl: 'https://example.com/about',
    completionEstimate: 0.6,
    reason: 'More information needed'
  })
}));

vi.mock('../../chains/navigation-decision-chain', () => ({
  runNavigationDecisionChain: vi.fn().mockResolvedValue({
    action: 'complete',
    completionEstimate: 0.85,
    reason: 'Sufficient information gathered'
  })
}));

describe('Scraper Chains', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('URL Analysis Chain', () => {
    it('should analyze a URL and return relevance scores', async () => {
      // Arrange
      const input = {
        url: 'https://example.com',
        scrapingGoal: 'Find information about example domains',
        currentState: {
          baseUrl: 'https://example.com',
          scrapingGoal: 'Find information about example domains',
          maxPages: 10,
          currentUrl: 'https://example.com',
          visitedUrls: new Set<string>(),
          pageQueue: {
            enqueue: vi.fn(),
            dequeue: vi.fn(),
            peek: vi.fn(),
            isEmpty: vi.fn(),
            size: vi.fn(),
            items: []
          },
          extractedContent: new Map(),
          currentPageDOM: '',
          currentPageText: '',
          valueMetrics: {
            informationDensity: 0,
            relevance: 0,
            uniqueness: 0,
            completeness: 0
          },
          finalOutput: {
            pages: [],
            summary: {
              pagesScraped: 0,
              totalContentSize: 0,
              executionTime: 0,
              goalCompletion: 0,
              coverageScore: 0
            }
          },
          requiresAuthentication: false
        }
      };

      // Act
      const result = await runURLAnalysisChain(input);

      // Assert
      expect(urlAnalyzer.analyzeUrl).toHaveBeenCalledWith(input.url, input.currentState);
      expect(result).toHaveProperty('relevanceScore');
      expect(result).toHaveProperty('expectedValue');
      expect(result).toHaveProperty('isAllowedByRobots');
      expect(result).toHaveProperty('domainAuthority');
    });
  });

  describe('Authentication Detection Chain', () => {
    it('should detect if a page requires authentication', async () => {
      // Arrange
      const input = {
        html: '<html><body><form action="/login"></form></body></html>',
        url: 'https://example.com',
        statusCode: 200
      };

      // Act
      const result = await runAuthenticationDetectionChain(input);

      // Assert
      expect(authHandler.detectAuthRequirements).toHaveBeenCalledWith(input.html, input.url, input.statusCode);
      expect(result).toHaveProperty('requiresAuthentication');
      expect(result).toHaveProperty('authType');
    });

    it('should create an auth request when a login form is detected', async () => {
      // Arrange
      const input = {
        html: '<html><body><form action="/login"><input name="username"><input name="password"></form></body></html>',
        url: 'https://example.com/login',
        statusCode: 200
      };

      // Override the mock for this test
      vi.mocked(authHandler.detectAuthRequirements).mockResolvedValueOnce({
        requiresAuthentication: true,
        authType: 'form',
        loginUrl: 'https://example.com/login',
        formFields: ['username', 'password']
      });

      // Mock the RunnableSequence to return that authentication is required
      vi.mocked(RunnableSequence.from).mockImplementationOnce(() => ({
        invoke: vi.fn().mockResolvedValue({
          requiresAuthentication: true,
          authType: 'form',
          loginUrl: 'https://example.com/login',
          isLoginPage: true,
          reasonForDetection: 'Found login form'
        })
      }) as unknown as RunnableSequence<unknown, unknown>);

      // Act
      const result = await runAuthenticationDetectionChain(input);

      // Assert
      expect(result.requiresAuthentication).toBe(true);
      expect(result.authType).toBe('form');
      expect(result.authRequest).toBeDefined();
    });
  });

  describe('Content Extraction Chain', () => {
    it('should extract content from HTML', async () => {
      // Arrange
      const input = {
        html: '<html><body><h1>Example Domain</h1><p>This domain is used for examples.</p></body></html>',
        url: 'https://example.com',
        currentState: {
          baseUrl: 'https://example.com',
          scrapingGoal: 'Find information',
          maxPages: 10,
          currentUrl: 'https://example.com',
          visitedUrls: new Set<string>(),
          pageQueue: {
            enqueue: vi.fn(),
            dequeue: vi.fn(),
            peek: vi.fn(),
            isEmpty: vi.fn(),
            size: vi.fn(),
            items: []
          },
          extractedContent: new Map(),
          currentPageDOM: '',
          currentPageText: '',
          valueMetrics: {
            informationDensity: 0,
            relevance: 0,
            uniqueness: 0,
            completeness: 0
          },
          finalOutput: {
            pages: [],
            summary: {
              pagesScraped: 0,
              totalContentSize: 0,
              executionTime: 0,
              goalCompletion: 0,
              coverageScore: 0
            }
          },
          requiresAuthentication: false
        }
      };

      // Act
      const result = await runContentExtractionChain(input);

      // Assert
      expect(contentExtractor.extractContent).toHaveBeenCalledWith(input.html, input.url, input.currentState);
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('contentType');
      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toHaveProperty('informationDensity');
      expect(result.metrics).toHaveProperty('relevance');
      expect(result.metrics).toHaveProperty('uniqueness');
    });
  });

  describe('Link Discovery Chain', () => {
    it('should discover and prioritize links', async () => {
      // Arrange
      const input = {
        html: '<html><body><a href="https://example.com/about">About</a></body></html>',
        currentUrl: 'https://example.com',
        currentState: {
          baseUrl: 'https://example.com',
          scrapingGoal: 'Find information',
          maxPages: 10,
          currentUrl: 'https://example.com',
          visitedUrls: new Set<string>(),
          pageQueue: {
            enqueue: vi.fn(),
            dequeue: vi.fn(),
            peek: vi.fn(),
            isEmpty: vi.fn(),
            size: vi.fn(),
            items: []
          },
          extractedContent: new Map(),
          currentPageDOM: '',
          currentPageText: '',
          valueMetrics: {
            informationDensity: 0,
            relevance: 0,
            uniqueness: 0,
            completeness: 0
          },
          finalOutput: {
            pages: [],
            summary: {
              pagesScraped: 0,
              totalContentSize: 0,
              executionTime: 0,
              goalCompletion: 0,
              coverageScore: 0
            }
          },
          requiresAuthentication: false
        }
      };

      // Act
      const result = await runLinkDiscoveryChain(input);

      // Assert
      expect(linkPrioritizer.identifyLinks).toHaveBeenCalledWith(input.html, input.currentUrl, input.currentState);
      expect(result).toHaveProperty('links');
      expect(Array.isArray(result.links)).toBe(true);
      if (result.links.length > 0) {
        expect(result.links[0]).toHaveProperty('url');
        expect(result.links[0]).toHaveProperty('predictedValue');
      }
    });
  });

  describe('Progress Evaluation Chain', () => {
    it('should evaluate scraping progress', async () => {
      // Arrange
      const input = {
        currentState: {
          baseUrl: 'https://example.com',
          scrapingGoal: 'Find information',
          maxPages: 10,
          currentUrl: 'https://example.com',
          visitedUrls: new Set<string>(['https://example.com']),
          pageQueue: {
            enqueue: vi.fn(),
            dequeue: vi.fn(),
            peek: vi.fn(),
            isEmpty: vi.fn(),
            size: vi.fn(),
            items: []
          },
          extractedContent: new Map([
            ['https://example.com', {
              url: 'https://example.com',
              title: 'Example Domain',
              content: 'This domain is used for examples.',
              contentType: 'text/html',
              extractionTime: new Date().toISOString(),
              metrics: {
                informationDensity: 0.7,
                relevance: 0.8,
                uniqueness: 0.9
              },
              links: [],
              entities: []
            }]
          ]),
          currentPageDOM: '',
          currentPageText: '',
          valueMetrics: {
            informationDensity: 0.7,
            relevance: 0.8,
            uniqueness: 0.9,
            completeness: 0.5
          },
          finalOutput: {
            pages: [],
            summary: {
              pagesScraped: 1,
              totalContentSize: 30,
              executionTime: 0,
              goalCompletion: 0,
              coverageScore: 0
            }
          },
          requiresAuthentication: false
        }
      };

      // Act
      const result = await runProgressEvaluationChain(input);

      // Assert
      expect(navigationDecision.evaluateProgress).toHaveBeenCalledWith(input.currentState);
      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toHaveProperty('informationDensity');
      expect(result.metrics).toHaveProperty('relevance');
      expect(result.metrics).toHaveProperty('uniqueness');
      expect(result.metrics).toHaveProperty('completeness');
    });
  });

  describe('Navigation Decision Chain', () => {
    it('should decide whether to continue or complete scraping', async () => {
      // Arrange
      const input = {
        currentState: {
          baseUrl: 'https://example.com',
          scrapingGoal: 'Find information',
          maxPages: 10,
          currentUrl: 'https://example.com',
          visitedUrls: new Set<string>(['https://example.com']),
          pageQueue: {
            enqueue: vi.fn(),
            dequeue: vi.fn(),
            peek: vi.fn().mockReturnValue({
              url: 'https://example.com/about',
              expectedValue: 0.8,
              depth: 1
            }),
            isEmpty: vi.fn().mockReturnValue(false),
            size: vi.fn().mockReturnValue(1),
            items: []
          },
          extractedContent: new Map(),
          currentPageDOM: '',
          currentPageText: '',
          valueMetrics: {
            informationDensity: 0.7,
            relevance: 0.8,
            uniqueness: 0.9,
            completeness: 0.5
          },
          finalOutput: {
            pages: [],
            summary: {
              pagesScraped: 1,
              totalContentSize: 0,
              executionTime: 0,
              goalCompletion: 0,
              coverageScore: 0
            }
          },
          requiresAuthentication: false
        },
        progressMetrics: {
          informationDensity: 0.7,
          relevance: 0.8,
          uniqueness: 0.9,
          completeness: 0.5
        }
      };

      // Override the mock just for this test to ensure it returns an action
      vi.mocked(RunnableSequence.from).mockImplementationOnce(() => ({
        invoke: vi.fn().mockResolvedValue({
          action: 'continue',
          reason: 'More information needed',
          completionEstimate: 0.5,
          shouldExploreNewAreas: false
        })
      }) as unknown as RunnableSequence<unknown, unknown>);

      // Act
      const result = await runNavigationDecisionChain(input);

      // Assert
      expect(navigationDecision.decideNextAction).toHaveBeenCalledWith(input.currentState);
      expect(result).toHaveProperty('action');
      expect(typeof result.action).toBe('string');
      expect(['continue', 'complete'].includes(result.action)).toBe(true);
      expect(result).toHaveProperty('completionEstimate');
    });

    it('should decide to complete when progress is high', async () => {
      // Arrange
      const input = {
        currentState: {
          baseUrl: 'https://example.com',
          scrapingGoal: 'Find information',
          maxPages: 10,
          currentUrl: 'https://example.com',
          visitedUrls: new Set<string>(['https://example.com']),
          pageQueue: {
            enqueue: vi.fn(),
            dequeue: vi.fn(),
            peek: vi.fn(),
            isEmpty: vi.fn(),
            size: vi.fn(),
            items: []
          },
          extractedContent: new Map(),
          currentPageDOM: '',
          currentPageText: '',
          valueMetrics: {
            informationDensity: 0.9,
            relevance: 0.9,
            uniqueness: 0.9,
            completeness: 0.9
          },
          finalOutput: {
            pages: [],
            summary: {
              pagesScraped: 1,
              totalContentSize: 0,
              executionTime: 0,
              goalCompletion: 0,
              coverageScore: 0
            }
          },
          requiresAuthentication: false
        },
        progressMetrics: {
          informationDensity: 0.9,
          relevance: 0.9,
          uniqueness: 0.9,
          completeness: 0.9
        }
      };

      // Override the mock for this test
      vi.mocked(navigationDecision.decideNextAction).mockResolvedValueOnce({
        action: 'complete',
        nextUrl: undefined,
        completionEstimate: 0.95,
        reason: 'Goal completion is high'
      });

      // Mock the RunnableSequence
      vi.mocked(RunnableSequence.from).mockImplementationOnce(() => ({
        invoke: vi.fn().mockResolvedValue({
          action: 'complete',
          reason: 'Goal completion is high',
          completionEstimate: 0.95
        })
      }) as unknown as RunnableSequence<unknown, unknown>);

      // Act
      const result = await runNavigationDecisionChain(input);

      // Assert
      expect(result.action).toBe('complete');
      expect(result.completionEstimate).toBeGreaterThan(0.9);
    });
  });
}); 