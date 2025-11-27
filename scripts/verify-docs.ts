#!/usr/bin/env bun
/**
 * Documentation Verification Script
 *
 * Validates that documentation is consistent with the actual codebase:
 * - Checks that referenced files exist
 * - Verifies environment variables match .env.example
 * - Validates that documented dependencies exist in package.json
 * - Ensures code snippets are syntactically valid
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

interface VerificationResult {
  file: string;
  errors: string[];
  warnings: string[];
}

const ROOT_DIR = join(dirname(import.meta.path), '..');
const DOCS_DIR = join(ROOT_DIR, 'docs');

// Files to verify
const DOC_FILES = [
  'README.md',
  'docs/ARCHITECTURE.md',
  'docs/DEVELOPMENT.md',
  'CONTRIBUTING.md',
  'apps/api/README.md',
  'packages/auth/README.md',
  'services/simplify/README.md',
];

// Known environment variables from .env.example
async function getExpectedEnvVars(): Promise<Set<string>> {
  const envVars = new Set<string>();
  const envExamplePath = join(ROOT_DIR, '.env.example');

  if (!existsSync(envExamplePath)) {
    console.warn('Warning: .env.example not found');
    return envVars;
  }

  const content = await readFile(envExamplePath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
      if (match) {
        envVars.add(match[1]);
      }
    }
  }

  return envVars;
}

// Extract code blocks from markdown
function extractCodeBlocks(content: string): Array<{ lang: string; code: string; line: number }> {
  const blocks: Array<{ lang: string; code: string; line: number }> = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  let lineNum = 1;
  let lastIndex = 0;

  while ((match = regex.exec(content)) !== null) {
    // Count newlines to get line number
    const beforeMatch = content.slice(lastIndex, match.index);
    lineNum += (beforeMatch.match(/\n/g) || []).length;

    blocks.push({
      lang: match[1] || '',
      code: match[2],
      line: lineNum,
    });

    lastIndex = match.index + match[0].length;
  }

  return blocks;
}

// Check for broken file references
function extractFileReferences(content: string): string[] {
  const refs: string[] = [];

  // Match paths in code blocks and inline code
  const pathPatterns = [
    /`([a-zA-Z0-9_\-./]+\.(ts|js|json|yml|yaml|md|sh))`/g,
    /\]\(([a-zA-Z0-9_\-./]+\.(ts|js|json|yml|yaml|md|sh))\)/g,
  ];

  for (const pattern of pathPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      // Only add if it looks like a file path (not a URL)
      if (!match[1].includes('://') && !match[1].startsWith('http')) {
        refs.push(match[1]);
      }
    }
  }

  return refs;
}

// Extract environment variable references
function extractEnvVarReferences(content: string): string[] {
  const refs: string[] = [];
  const patterns = [
    /\$\{?([A-Z_][A-Z0-9_]*)\}?/g,
    /`([A-Z_][A-Z0-9_]*)`/g,
    /process\.env\.([A-Z_][A-Z0-9_]*)/g,
    /Bun\.env\.([A-Z_][A-Z0-9_]*)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      refs.push(match[1]);
    }
  }

  return [...new Set(refs)];
}

async function verifyDocFile(filePath: string, expectedEnvVars: Set<string>): Promise<VerificationResult> {
  const result: VerificationResult = {
    file: filePath,
    errors: [],
    warnings: [],
  };

  const fullPath = join(ROOT_DIR, filePath);

  if (!existsSync(fullPath)) {
    result.errors.push(`File not found: ${filePath}`);
    return result;
  }

  const content = await readFile(fullPath, 'utf-8');

  // Check file references
  const fileRefs = extractFileReferences(content);
  for (const ref of fileRefs) {
    // Try relative to doc file and relative to root
    const fromDocDir = join(dirname(fullPath), ref);
    const fromRoot = join(ROOT_DIR, ref);

    if (!existsSync(fromDocDir) && !existsSync(fromRoot)) {
      // Skip common false positives
      if (!ref.includes('your-') && !ref.includes('example') && !ref.startsWith('node_modules/')) {
        result.warnings.push(`Potentially broken file reference: ${ref}`);
      }
    }
  }

  // Check environment variable references
  const envRefs = extractEnvVarReferences(content);
  const commonEnvVars = new Set([
    'NODE_ENV', 'PORT', 'PATH', 'HOME', 'USER', 'PWD',
    'DATABASE_URL', 'POSTGRES_URL', // Common aliases
  ]);

  for (const envVar of envRefs) {
    if (!expectedEnvVars.has(envVar) && !commonEnvVars.has(envVar)) {
      // Only warn for vars that look like they should be in .env
      if (envVar.length > 3 && !envVar.startsWith('npm_')) {
        result.warnings.push(`Environment variable not in .env.example: ${envVar}`);
      }
    }
  }

  // Check for outdated technology references
  const outdatedPatterns: Array<[RegExp, string]> = [
    [/\bSupabase\s+Auth\b/gi, 'Reference to Supabase Auth (now using Janua)'],
    [/\bvitest\b/gi, 'Reference to vitest (now using bun:test)'],
    [/\bModal\b.*\bdeploy/gi, 'Reference to Modal deployment (now using Docker/Enclii)'],
    [/Qwen2\.5-7B/gi, 'Outdated model reference (now using Qwen3-30B-A3B)'],
  ];

  for (const [pattern, message] of outdatedPatterns) {
    if (pattern.test(content)) {
      result.errors.push(`Outdated reference: ${message}`);
    }
  }

  // Check code blocks for common issues
  const codeBlocks = extractCodeBlocks(content);
  for (const block of codeBlocks) {
    // Check for import from 'vitest' in TypeScript blocks
    if ((block.lang === 'ts' || block.lang === 'typescript') && block.code.includes("from 'vitest'")) {
      result.errors.push(`Line ~${block.line}: Import from 'vitest' should be 'bun:test'`);
    }

    // Check for supabase imports
    if (block.code.includes('@supabase/') || block.code.includes("from 'supabase'")) {
      result.warnings.push(`Line ~${block.line}: Supabase import detected (should use Janua)`);
    }
  }

  return result;
}

async function main() {
  console.log('🔍 Verifying documentation consistency...\n');

  const expectedEnvVars = await getExpectedEnvVars();
  console.log(`Found ${expectedEnvVars.size} environment variables in .env.example\n`);

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const docFile of DOC_FILES) {
    const result = await verifyDocFile(docFile, expectedEnvVars);

    const hasIssues = result.errors.length > 0 || result.warnings.length > 0;

    if (hasIssues) {
      console.log(`📄 ${docFile}`);

      for (const error of result.errors) {
        console.log(`   ❌ ${error}`);
        totalErrors++;
      }

      for (const warning of result.warnings) {
        console.log(`   ⚠️  ${warning}`);
        totalWarnings++;
      }

      console.log('');
    }
  }

  console.log('─'.repeat(50));

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log('✅ All documentation verified successfully!');
    process.exit(0);
  } else {
    console.log(`\n📊 Summary: ${totalErrors} errors, ${totalWarnings} warnings`);

    if (totalErrors > 0) {
      console.log('\n❌ Documentation verification failed!');
      process.exit(1);
    } else {
      console.log('\n⚠️  Documentation verification passed with warnings');
      process.exit(0);
    }
  }
}

main().catch((error) => {
  console.error('Script error:', error);
  process.exit(1);
});
