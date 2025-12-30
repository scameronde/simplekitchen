/**
 * @module recipe-importer
 * Web recipe importer that fetches URLs and extracts Schema.org JSON-LD data.
 * Uses Electron's BrowserWindow with security settings to safely extract recipe markup.
 */

import { BrowserWindow } from 'electron';
import type { SchemaOrgRecipe } from '../../shared/types/schema-org.js';

/**
 * Extracts a Schema.org Recipe from a URL by fetching the page and parsing JSON-LD markup.
 *
 * @param url - The URL of the recipe page to fetch
 * @returns The first Schema.org Recipe found on the page
 * @throws Error if URL is invalid, fetch times out, or no recipe is found
 */
export async function extractSchemaOrgRecipe(url: string): Promise<SchemaOrgRecipe> {
  // Validate URL format
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('Invalid URL format. Must start with http:// or https://');
  }

  // Create isolated BrowserWindow with security settings
  const browserWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  try {
    // Load URL with timeout (15 seconds)
    const loadPromise = browserWindow.loadURL(url);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Recipe fetch timed out after 15 seconds'));
      }, 15000);
    });

    await Promise.race([loadPromise, timeoutPromise]);

    // Execute script in page context to extract JSON-LD
    const recipes = await browserWindow.webContents.executeJavaScript(`
      (function() {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        const recipes = [];
        scripts.forEach(script => {
          try {
            const data = JSON.parse(script.textContent);
            if (data['@type'] === 'Recipe') recipes.push(data);
            if (Array.isArray(data['@graph'])) {
              data['@graph'].forEach(item => {
                if (item['@type'] === 'Recipe') recipes.push(item);
              });
            }
          } catch (e) {
            /* ignore malformed JSON */
          }
        });
        return recipes;
      })()
    `);

    // Validate that recipes were found
    if (!recipes || recipes.length === 0) {
      throw new Error('No Schema.org recipe markup found on this page');
    }

    // Return the first recipe found
    return recipes[0] as SchemaOrgRecipe;
  } finally {
    // Close BrowserWindow properly in finally block to prevent resource leaks
    browserWindow.destroy();
  }
}
