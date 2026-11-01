# Documentation Contribution Guide

This guide helps you contribute documentation improvements to NaijaTaste AI.

## Documentation Standards

### Style Guide
- Use clear, concise language
- Follow conventional commits format: `docs:`, `fix:`, `feat:`, `test:`, `chore:`
- Keep examples up-to-date and runnable
- Include error examples where relevant
- Use consistent formatting with existing docs

### Markdown Conventions
- Use `##` for main sections, `###` for subsections
- Code blocks use triple backticks with language specification
- Tables should have headers and consistent formatting
- Include badges for status indicators when relevant

### Documentation Checklist
- [ ] README badges reflect current status
- [ ] API documentation matches implementation
- [ ] Installation instructions work
- [ ] Examples are current and tested
- [ ] Error examples match actual responses
- [ ] Links are working
- [ ] Contributing guidelines are up-to-date

## Quick Documentation Fixes

### README Updates
- Update test count badges when tests change
- Fix deployment status messages
- Update environment variable tables
- Correct API path documentation
- Add missing features to feature list

### API Documentation
- Ensure endpoint counts match `/health` response
- Fix canonical path documentation
- Update error response examples
- Add missing endpoints to documentation
- Correct rate limiting documentation

### Architecture Documentation
- Update architecture diagrams to match implementation
- Fix deployment instructions
- Update environment setup steps
- Correct troubleshooting sections
- Add performance metrics when available

## Common Issues to Fix

1. **Test count mismatch**: README shows 156 tests, actual is 93
2. **API path confusion**: Documentation mentions `/api/v1/*` but actual paths use `/api/*`
3. **Deployment status**: README says "API function not yet serving" but it's live
4. **Environment defaults**: Missing default values table
5. **Error format**: Inconsistent error response documentation

## Contributing Process

1. Make your changes following the style guide
2. Test examples if possible
3. Commit with conventional commit format
4. Push to create a pull request
5. Documentation changes are typically merged quickly

## Templates

### New Feature Documentation
```markdown
## Feature Name
Brief description of the feature.

### How it works
Technical explanation of implementation.

### Usage
```javascript
// Example code
```

### API Reference
If applicable, document endpoints, parameters, responses.
```

### Bug Fix Documentation
```markdown
## Issue Description
Brief description of the bug and fix.

### Before
Description of the problematic behavior.

### After
Description of the fixed behavior.

### Technical Details
Explanation of the root cause and solution.
```
