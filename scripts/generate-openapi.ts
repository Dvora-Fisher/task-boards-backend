// Writes the OpenAPI document to docs/openapi.json (for the React side, Postman, code generators...).
// Run: npm run docs:generate
import { writeFileSync, mkdirSync } from 'node:fs';
import { openApiDocument } from '../src/docs/openapi.js';

mkdirSync('docs', { recursive: true });
writeFileSync('docs/openapi.json', `${JSON.stringify(openApiDocument, null, 2)}\n`, 'utf8');
console.log('docs/openapi.json written');
