/**
 * Authentication Handler Module
 * 
 * This module detects and handles authentication requirements for websites,
 * supporting human-in-the-loop authentication when needed.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ExtendedScraperAgentState } from '../state';
import type { HumanAuthRequest } from '../types';

interface AuthDetectionResult {
  requiresAuthentication: boolean;
  authType: 'basic' | 'form' | 'oauth' | 'unknown';
  loginUrl?: string;
  formFields?: string[];
}

/**
 * Detect if a page requires authentication
 */
export async function detectAuthRequirements(
  html: string,
  url: string,
  status: number
): Promise<AuthDetectionResult> {
  // Check if the page redirected to a login page
  const isLoginPage = checkIfLoginPage(html, url);
  
  // Check if the page has login forms
  const hasLoginForm = checkForLoginForm(html);
  
  // Check if the status code indicates authentication is required
  const statusRequiresAuth = status === 401 || status === 403;
  
  // Determine the authentication type
  let authType: 'basic' | 'form' | 'oauth' | 'unknown' = 'unknown';
  
  if (status === 401 && /www-authenticate/i.test(html)) {
    authType = 'basic';
  } else if (hasLoginForm) {
    authType = 'form';
  } else if (/oauth|authorize|authentication/i.test(url)) {
    authType = 'oauth';
  }
  
  // Extract form fields if it's a form-based authentication
  const formFields = authType === 'form' ? extractFormFields(html) : undefined;
  
  // Extract the login URL if it's different from the current URL
  const loginUrl = isLoginPage ? url : findLoginUrl(html, url);
  
  return {
    requiresAuthentication: isLoginPage || hasLoginForm || statusRequiresAuth,
    authType,
    loginUrl,
    formFields
  };
}

/**
 * Generate a human authentication request
 */
export async function createAuthRequest(
  url: string,
  authType: 'basic' | 'form' | 'oauth' | 'unknown',
  formFields?: string[]
): Promise<HumanAuthRequest> {
  // Generate a unique session token
  const sessionToken = uuidv4();
  
  // Create a callback URL (in a real implementation, this would be a secure endpoint)
  const callbackUrl = `https://example.com/auth-callback?session=${sessionToken}`;
  
  // Generate custom instructions based on the auth type
  let instructions = '';
  
  switch (authType) {
    case 'basic':
      instructions = 'Please provide your username and password for basic authentication.';
      break;
    case 'form':
      instructions = `Please log in using the form. Required fields: ${formFields?.join(', ') || 'username, password'}`;
      break;
    case 'oauth':
      instructions = 'Please authorize access through the OAuth flow.';
      break;
    default:
      instructions = 'Please authenticate with the website using your credentials.';
  }
  
  // Generate an authentication portal URL
  // In a real implementation, this would be a secure page that helps the user authenticate
  const authPortalUrl = `https://example.com/auth-portal?target=${encodeURIComponent(url)}&session=${sessionToken}`;
  
  return {
    url,
    authType,
    formFields,
    instructions,
    callbackUrl,
    sessionToken,
    authPortalUrl
  };
}

/**
 * Handle the authentication process, potentially involving a human
 */
export async function handleAuthentication(
  authRequest: HumanAuthRequest,
  state: ExtendedScraperAgentState
): Promise<boolean> {
  // In a real implementation, this would:
  // 1. Notify the user through configured channels
  // 2. Wait for the user to authenticate (with timeout)
  // 3. Capture and securely store the authentication tokens
  
  // For this example, we'll just simulate success after a delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Update the state to indicate that authentication has been handled
  state.requiresAuthentication = false;
  
  return true;
}

/**
 * Check if a page is a login page
 */
function checkIfLoginPage(html: string, url: string): boolean {
  // Check URL patterns
  if (/login|signin|authenticate|auth\/|sso/i.test(url)) {
    return true;
  }
  
  // Check page title
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  if (titleMatch && /login|sign in|authenticate/i.test(titleMatch[1])) {
    return true;
  }
  
  // Check for login forms
  if (/<form[^>]*(?:login|signin|authentication)[^>]*>/i.test(html)) {
    return true;
  }
  
  // Check for common login elements
  return (
    /<input[^>]*type=["']password["'][^>]*>/i.test(html) &&
    (/<input[^>]*type=["'](?:text|email|tel)["'][^>]*>/i.test(html) ||
     /<input[^>]*type=["'](?:submit|button)["'][^>]*(?:login|signin|submit)[^>]*>/i.test(html))
  );
}

/**
 * Check if a page contains a login form
 */
function checkForLoginForm(html: string): boolean {
  // Check for forms with password fields
  return (
    /<form[^>]*>[\s\S]*?<input[^>]*type=["']password["'][^>]*>[\s\S]*?<\/form>/i.test(html)
  );
}

/**
 * Extract form fields from a login form
 */
function extractFormFields(html: string): string[] {
  const fields: string[] = [];
  
  // Find the login form
  const formRegex = /<form[^>]*>[\s\S]*?<input[^>]*type=["']password["'][^>]*>[\s\S]*?<\/form>/i;
  const formMatch = html.match(formRegex);
  
  if (formMatch) {
    const form = formMatch[0];
    
    // Extract input names
    const inputRegex = /<input[^>]*name=["']([^"']+)["'][^>]*>/gi;
    let inputMatch;
    
    while ((inputMatch = inputRegex.exec(form)) !== null) {
      if (inputMatch[1] && !inputMatch[1].includes('csrf') && !inputMatch[1].includes('token')) {
        fields.push(inputMatch[1]);
      }
    }
  }
  
  return fields;
}

/**
 * Find the login URL if it's different from the current URL
 */
function findLoginUrl(html: string, currentUrl: string): string | undefined {
  // Look for login links
  const loginLinkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>(?:[^<]*(?:login|sign\s*in|log\s*in)[^<]*)<\/a>/i;
  const loginMatch = html.match(loginLinkRegex);
  
  if (loginMatch && loginMatch[1]) {
    try {
      // Resolve relative URLs to absolute URLs
      return new URL(loginMatch[1], currentUrl).toString();
    } catch {
      return undefined;
    }
  }
  
  return undefined;
} 