# Authentication Agent

The Authentication Agent is a specialized component designed to handle website authentication challenges. It works as a sub-agent of the Scraper Agent, activating only when authentication is required for accessing web content.

## Architecture

```
                                                 ┌───────────────────┐
                                                 │                   │
                                        ┌───────▶│    Web Browser    │
                                        │        │                   │
                                        │        └───────────────────┘
                                        │                 ▲
                                        │                 │
┌───────────────────┐    ┌─────────────┴──────┐    ┌─────┴───────────┐
│                   │    │                     │    │                 │
│                   │    │                     │    │                 │
│   Scraper Agent   │───▶│  Authentication     │───▶│  Chat Interface │
│                   │    │  Agent              │    │                 │
│                   │    │                     │◀───│                 │
└───────────────────┘    └─────────────┬──────┘    └─────────────────┘
        ▲   │                          │
        │   │                          │
        │   │                          │
┌───────┴───┴────────┐    ┌────────────▼───────┐
│                    │    │                     │
│  Content Storage   │    │   Session Storage   │
│                    │    │                     │
└────────────────────┘    └─────────────────────┘
```

## Flow of Operation

1. **Detection**: Scraper Agent detects an authentication requirement while processing a URL
2. **Pause**: Scraper Agent pauses the current scraping process
3. **Activation**: Authentication Agent is activated with the authentication challenge details
4. **Analysis**: Authentication Agent analyzes the type of authentication required
5. **User Interaction**: Agent prompts the user for credentials through the chat interface
6. **Authentication**: Handles the authentication process with the website
7. **Session Management**: Maintains and provides authenticated session data
8. **Options**: Offers user options to skip authentication, continue without authenticated content, or retry
9. **Resume**: Returns control to Scraper Agent with authenticated session for continued scraping

## Authentication Types Supported

- **Basic Authentication**: Username/password via HTTP headers
- **Form-Based Authentication**: Web forms requiring credential submission
- **OAuth**: Support for common OAuth flows
- **Multi-Factor Authentication**: Handling of MFA challenges with user interaction
- **CAPTCHA**: Recognition and solving of CAPTCHA challenges
- **Cookie-Based Auth**: Handling and managing cookie-based sessions

## Chat Interface Implementation

The Authentication Agent communicates with users through a chat interface that:

1. **Informs**: Clearly explains which site needs authentication and why
2. **Requests**: Asks for specific credentials in a secure manner
3. **Guides**: Provides instructions for completing authentication flows
4. **Offers Options**: Presents choices to skip, continue without auth, or retry
5. **Provides Feedback**: Reports on authentication success or failure

Example chat interactions:

```
Auth Agent: I've encountered a login page at example.com while scraping. Would you like to:
1. Provide login credentials
2. Skip this authenticated content
3. Try to access without authentication

User: I'll provide login credentials

Auth Agent: Please enter your username for example.com:

User: myusername

Auth Agent: Please enter your password for example.com:
(Your password will be handled securely)

User: mypassword

Auth Agent: Attempting to authenticate... Success! Continuing with scraping.
```

## Integration with Scraper

The Authentication Agent is designed to work seamlessly with the non-recursive scraper implementation:

```typescript
async function processUrl(url: string, state: ScraperState): Promise<UrlProcessingResult> {
  // Fetch initial page
  const { html, status } = await fetchPage(url);
  
  // Check for authentication
  const authResult = await detectAuthentication(html, url, status);
  
  if (authResult.requiresAuthentication) {
    // Pause scraping process
    state.setScrapingStatus('paused', `Authentication required for ${url}`);
    
    // Activate Authentication Agent
    const authAgent = new AuthenticationAgent({
      onUserPromptNeeded: state.chatInterface.promptUser,
      sessionStore: state.authSessionStore
    });
    
    // Handle the authentication challenge
    const authSession = await authAgent.authenticate({
      url,
      authType: authResult.authType,
      formData: authResult.formData,
      challenge: html
    });
    
    if (authSession.success) {
      // Resume with authenticated session
      state.setScrapingStatus('active', `Authentication successful for ${url}`);
      const newResult = await fetchPage(url, {
        cookies: authSession.cookies,
        headers: authSession.headers
      });
      return processContentFromAuthenticatedPage(newResult, state);
    } else if (authSession.skipRequested) {
      // User chose to skip this content
      state.setScrapingStatus('active', `Skipping authenticated content at ${url}`);
      return {
        status: 'skipped',
        reason: 'authentication_skipped',
        url
      };
    } else {
      // Handle authentication failure
      state.setScrapingStatus('active', `Continuing without authentication for ${url}`);
      return handleAuthFailure(url, authSession.error, state);
    }
  }
  
  // Normal processing for non-authenticated pages
  return processRegularPage(html, url, state);
}
```

## Pause and Resume Mechanism

The Authentication Agent implements a pause/resume mechanism for the scraping process:

1. **Detection and Pause**: When authentication is required, the scraper pauses its operations
2. **State Preservation**: Current scraping state is preserved, including URL queue and progress
3. **User Interaction**: Authentication Agent handles user communication while scraper is paused
4. **Decision Points**: User can decide to:
   - Provide credentials and continue with full access
   - Skip the authenticated content and continue with limited access
   - Abort the current scraping task entirely
5. **Graceful Resume**: Once authentication is resolved, scraping resumes from where it was paused

## Benefits of Dedicated Authentication Agent

1. **Separation of Concerns**: Keeps authentication logic separate from content scraping
2. **Specialized Expertise**: Authentication Agent can become an expert in handling various auth types
3. **Improved User Experience**: Provides clear, focused prompts for auth requirements
4. **Session Persistence**: Can maintain sessions across multiple pages of the same domain
5. **Security**: Proper handling of credentials and secure session management
6. **Reusability**: Can be used by other agents that need authentication capabilities

## State Management

The Authentication Agent maintains its own state including:

- Active sessions by domain
- Authentication history
- Cached credentials (securely stored)
- Success/failure metrics
- User preferences for specific domains (always skip, always ask, etc.)

## Error Handling

Specialized error handling for authentication challenges:

- Credential rejection handling
- Rate limiting detection
- Anti-bot measures detection
- MFA challenge resolution
- Session expiration handling
- Connection timeout management during authentication

## Future Enhancements

1. **Authentication Profile Library**: Pre-configured profiles for common websites
2. **Automated Credential Rotation**: For scenarios requiring frequent auth changes
3. **Browser Fingerprint Simulation**: To avoid detection as a bot
4. **Proxy Integration**: Rotating proxies for authentication challenges
5. **ML-Based Form Recognition**: Improved detection of login forms and requirements
6. **Encrypted Credential Storage**: Enhanced security for stored authentication data 