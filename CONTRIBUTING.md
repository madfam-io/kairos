# Contributing to Kairos

Thank you for your interest in contributing to Kairos! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Submitting Changes](#submitting-changes)
- [Code Style](#code-style)
- [Testing](#testing)
- [Documentation](#documentation)
- [Issue Guidelines](#issue-guidelines)

## Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in all interactions.

### Our Standards

- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Git

### Setup

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/kairos.git
cd kairos

# Add upstream remote
git remote add upstream https://github.com/kairos-app/kairos.git

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Start development
pnpm dev
```

For detailed setup instructions, see the [Development Guide](docs/DEVELOPMENT.md).

## Development Process

### Branch Workflow

```
main (protected)
  │
  ├── feature/add-grammar-explainer
  ├── fix/segmentation-error
  └── docs/update-api-reference
```

1. Create a branch from `main`
2. Make your changes
3. Submit a pull request
4. Address review feedback
5. Merge when approved

### Branch Naming

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/batch-mining` |
| `fix/` | Bug fixes | `fix/sync-conflict` |
| `docs/` | Documentation | `docs/api-examples` |
| `refactor/` | Code refactoring | `refactor/auth-flow` |
| `test/` | Test additions | `test/nlp-service` |
| `chore/` | Maintenance | `chore/update-deps` |

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance

**Examples:**

```bash
feat(mining): add batch export to Anki

- Support exporting multiple cards at once
- Add progress indicator during export
- Include audio files in export

Closes #123
```

```bash
fix(nlp): handle proper nouns in segmentation

Previously, names like 哈利波特 were incorrectly segmented.
This fix uses the NER model to identify and preserve proper nouns.

Fixes #456
```

## Submitting Changes

### Pull Request Process

1. **Update your branch:**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Ensure quality:**
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```

3. **Create pull request:**
   - Use a descriptive title
   - Fill out the PR template
   - Link related issues

4. **Address feedback:**
   - Respond to all comments
   - Make requested changes
   - Re-request review when ready

### PR Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactoring

## Related Issues
Closes #123

## Testing
Describe testing performed.

## Screenshots (if applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console warnings/errors
```

### Review Criteria

PRs are evaluated on:

- **Correctness**: Does it work as intended?
- **Code quality**: Is it clean and maintainable?
- **Testing**: Are there adequate tests?
- **Documentation**: Is it documented?
- **Performance**: Any performance impact?

## Code Style

### TypeScript

```typescript
// Use explicit types for function signatures
export function getVocabulary(userId: string): Promise<Vocabulary[]> {
  // ...
}

// Use interfaces for object shapes
export interface VocabularyWord {
  id: string;
  word: string;
  pinyin: string | null;
  hskLevel: number | null;
}

// Prefer const assertions for constants
const HSK_LEVELS = [1, 2, 3, 4, 5, 6] as const;
```

### React

```typescript
// Functional components with typed props
export interface CardListProps {
  cards: Card[];
  onSelect: (card: Card) => void;
}

export function CardList({ cards, onSelect }: CardListProps) {
  return (
    <ul>
      {cards.map((card) => (
        <li key={card.id} onClick={() => onSelect(card)}>
          {card.word}
        </li>
      ))}
    </ul>
  );
}
```

### Formatting

Prettier handles formatting automatically. Configuration:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### Linting

ESLint enforces code quality. Fix issues with:

```bash
pnpm lint:fix
```

## Testing

### Test Structure

```
src/
├── routes/
│   └── vocabulary.ts
tests/
├── unit/
│   └── vocabulary.test.ts
├── integration/
│   └── vocabulary.integration.test.ts
└── e2e/
    └── vocabulary.e2e.test.ts
```

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { calculateNextReview } from '../src/utils/srs';

describe('calculateNextReview', () => {
  it('should schedule easy cards further out', () => {
    const result = calculateNextReview({
      quality: 5,
      easeFactor: 2.5,
      interval: 1,
    });

    expect(result.interval).toBeGreaterThan(1);
  });

  it('should reset interval for failed cards', () => {
    const result = calculateNextReview({
      quality: 0,
      easeFactor: 2.5,
      interval: 10,
    });

    expect(result.interval).toBe(1);
  });
});
```

### Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @kairos/api test

# Watch mode
pnpm --filter @kairos/api test:watch

# Coverage
pnpm --filter @kairos/api test:coverage
```

### Coverage Requirements

- New features: 80% coverage minimum
- Bug fixes: Test that reproduces the bug

## Documentation

### When to Document

- New features
- API changes
- Configuration options
- Complex logic

### Documentation Types

| Type | Location | Purpose |
|------|----------|---------|
| Code comments | Inline | Complex logic explanation |
| JSDoc | Functions | API documentation |
| README | Package root | Package overview |
| Docs | `/docs` | Architecture, guides |

### JSDoc Example

```typescript
/**
 * Calculate the next review date using SM-2 algorithm.
 *
 * @param quality - Review quality (0-5)
 * @param easeFactor - Current ease factor (minimum 1.3)
 * @param interval - Current interval in days
 * @returns Updated SRS parameters
 *
 * @example
 * ```ts
 * const result = calculateNextReview({
 *   quality: 4,
 *   easeFactor: 2.5,
 *   interval: 1,
 * });
 * ```
 */
export function calculateNextReview(params: ReviewParams): ReviewResult {
  // ...
}
```

## Issue Guidelines

### Bug Reports

Include:

1. **Description**: Clear description of the bug
2. **Steps to reproduce**: Numbered steps
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happens
5. **Environment**: OS, browser, app version
6. **Screenshots**: If applicable

### Feature Requests

Include:

1. **Problem**: What problem does this solve?
2. **Solution**: Proposed solution
3. **Alternatives**: Other solutions considered
4. **Context**: Additional context

### Issue Labels

| Label | Description |
|-------|-------------|
| `bug` | Something isn't working |
| `feature` | New feature request |
| `docs` | Documentation improvement |
| `good first issue` | Good for newcomers |
| `help wanted` | Extra attention needed |
| `priority: high` | Urgent issue |

## Questions?

- Open a [GitHub Discussion](https://github.com/kairos-app/kairos/discussions)
- Join our [Discord](https://discord.gg/kairos)
- Email: dev@kairos.dev

## Related Documents

- [Development Guide](docs/DEVELOPMENT.md) - Local setup
- [Architecture](docs/ARCHITECTURE.md) - System design
- [API Reference](docs/API.md) - API documentation
