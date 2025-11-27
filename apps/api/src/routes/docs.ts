/**
 * API Documentation Routes
 *
 * Provides OpenAPI specification and Swagger UI for API documentation.
 */

import { Hono } from 'hono';
import { getOpenAPISpec } from '../lib/openapi';

export const docsRoutes = new Hono();

/**
 * GET /docs/openapi.json
 * Returns the OpenAPI specification as JSON
 */
docsRoutes.get('/openapi.json', (c) => {
  return c.json(getOpenAPISpec());
});

/**
 * GET /docs/openapi.yaml
 * Returns the OpenAPI specification as YAML
 */
docsRoutes.get('/openapi.yaml', (c) => {
  const spec = getOpenAPISpec();
  const yaml = jsonToYaml(spec);
  c.header('Content-Type', 'text/yaml');
  return c.text(yaml);
});

/**
 * GET /docs
 * Swagger UI for interactive API documentation
 */
docsRoutes.get('/', (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kairos API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui.css">
  <style>
    body {
      margin: 0;
      padding: 0;
    }
    .swagger-ui .topbar {
      display: none;
    }
    .swagger-ui .info {
      margin: 20px 0;
    }
    .swagger-ui .info .title {
      font-size: 2em;
    }
    /* Custom theme colors */
    .swagger-ui .opblock.opblock-get {
      border-color: #61affe;
      background: rgba(97, 175, 254, 0.1);
    }
    .swagger-ui .opblock.opblock-post {
      border-color: #49cc90;
      background: rgba(73, 204, 144, 0.1);
    }
    .swagger-ui .opblock.opblock-put {
      border-color: #fca130;
      background: rgba(252, 161, 48, 0.1);
    }
    .swagger-ui .opblock.opblock-delete {
      border-color: #f93e3e;
      background: rgba(249, 62, 62, 0.1);
    }
    .swagger-ui .opblock.opblock-patch {
      border-color: #50e3c2;
      background: rgba(80, 227, 194, 0.1);
    }
    /* Header customization */
    .custom-header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 20px 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .custom-header h1 {
      margin: 0;
      font-size: 1.5em;
      font-weight: 600;
    }
    .custom-header .version {
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 0.9em;
    }
    .custom-header a {
      color: #61affe;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="custom-header">
    <h1>Kairos API</h1>
    <div>
      <span class="version">v1.0.0</span>
      <a href="/docs/openapi.json" style="margin-left: 20px;">OpenAPI JSON</a>
      <a href="/docs/openapi.yaml" style="margin-left: 10px;">YAML</a>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: 'BaseLayout',
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: 'list',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        syntaxHighlight: {
          activate: true,
          theme: 'monokai'
        },
        tryItOutEnabled: true,
        requestInterceptor: (req) => {
          // Add auth token from localStorage if available
          const token = localStorage.getItem('kairos_auth_token');
          if (token && !req.headers.Authorization) {
            req.headers.Authorization = 'Bearer ' + token;
          }
          return req;
        }
      });
    };
  </script>
</body>
</html>`;

  return c.html(html);
});

/**
 * GET /docs/redoc
 * ReDoc alternative documentation viewer
 */
docsRoutes.get('/redoc', (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kairos API Documentation - ReDoc</title>
  <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <redoc spec-url='/docs/openapi.json'></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>`;

  return c.html(html);
});

/**
 * Simple JSON to YAML converter
 * (Basic implementation for the OpenAPI spec)
 */
function jsonToYaml(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);

  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (typeof obj === 'boolean') {
    return obj ? 'true' : 'false';
  }

  if (typeof obj === 'number') {
    return String(obj);
  }

  if (typeof obj === 'string') {
    // Check if string needs quoting
    if (
      obj.includes('\n') ||
      obj.includes(':') ||
      obj.includes('#') ||
      obj.includes("'") ||
      obj.includes('"') ||
      obj.startsWith(' ') ||
      obj.endsWith(' ') ||
      /^[0-9]/.test(obj) ||
      ['true', 'false', 'null', 'yes', 'no'].includes(obj.toLowerCase())
    ) {
      // Use literal block for multiline strings
      if (obj.includes('\n')) {
        const lines = obj.split('\n');
        return '|\n' + lines.map((line) => spaces + '  ' + line).join('\n');
      }
      // Quote the string
      return JSON.stringify(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '[]';
    }
    return obj
      .map((item) => {
        const value = jsonToYaml(item, indent + 1);
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          const lines = value.split('\n');
          return `${spaces}- ${lines[0]}\n${lines.slice(1).join('\n')}`;
        }
        return `${spaces}- ${value}`;
      })
      .join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) {
      return '{}';
    }
    return entries
      .map(([key, value]) => {
        const yamlValue = jsonToYaml(value, indent + 1);
        // Check if value is complex (object or array)
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value) && value.length === 0) {
            return `${spaces}${key}: []`;
          }
          if (!Array.isArray(value) && Object.keys(value).length === 0) {
            return `${spaces}${key}: {}`;
          }
          return `${spaces}${key}:\n${yamlValue}`;
        }
        return `${spaces}${key}: ${yamlValue}`;
      })
      .join('\n');
  }

  return String(obj);
}
