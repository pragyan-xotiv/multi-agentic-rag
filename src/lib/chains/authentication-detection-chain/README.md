# Authentication Detection Chain

## Purpose

The Authentication Detection Chain analyzes web pages to determine if authentication is required, identifies the type of authentication, and prepares for human-in-the-loop authentication if necessary.

## Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  HTML Content   │────►│  Login Page     │────►│  Login Form     │
│  & HTTP Status  │     │  Detection      │     │  Analysis       │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│    Auth Type    │────►│ Form Field      │────►│ Auth Request    │
│  Classification │     │ Identification  │     │ Generation      │
│                 │     │                 │     │                 │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│                 │
│  Authentication │
│  Result         │
│                 │
└─────────────────┘
```

## Core Module Usage

The chain uses the `auth-handler` core module at the following points:
- During Login Page Detection to identify login patterns in the HTML
- During Login Form Analysis to extract and understand form structure
- When classifying authentication type (basic, form, OAuth, etc.)
- During Form Field Identification to detect username, password, and other required fields
- When generating authentication requests for human-in-the-loop handling
- For storing and managing authentication tokens after successful login

## Inputs

- `html`: The HTML content of the page
- `url`: The URL of the page
- `statusCode`: The HTTP status code of the response

## Outputs

```typescript
{
  requiresAuthentication: boolean;
  authType: 'basic' | 'form' | 'oauth' | 'unknown';
  loginUrl?: string;
  formFields?: string[];
  authRequest?: HumanAuthRequest; // Generated if authentication is required
}
```

## Chain Components

1. **Login Page Detection**: Identify if the current page is a login page
2. **Form Analysis**: Detect and analyze login forms
3. **Authentication Type Classification**: Determine the type of authentication
4. **Login URL Extraction**: Find login URLs if the current page isn't a login page
5. **Form Field Identification**: Extract required form fields for form-based authentication
6. **Authentication Request Generation**: Create an authentication request for human intervention

## Integration Points

- Utilizes the `auth-handler` core module for authentication detection and handling
- Connects with human-in-the-loop processes for completing authentication
- Feeds back into the browser interface for continuing the scraping process

## Example Usage

```typescript
import { runAuthenticationDetectionChain } from "./lib/chains/authentication-detection-chain";

const result = await runAuthenticationDetectionChain({
  html: pageContent,
  url: "https://example.com/members-area",
  statusCode: 200
});

if (result.requiresAuthentication) {
  console.log(`Authentication required (${result.authType})`);
  
  // Handle authentication based on type
  if (result.authType === 'form' && result.authRequest) {
    // Request human authentication using the generated auth request
    await requestHumanAuthentication(result.authRequest);
  }
} else {
  // Proceed with content extraction
  // ...
}
``` 