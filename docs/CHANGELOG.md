# Changelog

All notable changes to NaijaTaste AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Chat recommendations are no longer latched after a zero-match turn; the next message retries.
- Chat responses include `after_hard_filter` / `candidates_sent_to_llm`, which the results panel renders.
- `ErrorBoundary` imports React correctly, and `useRetry` is bounded instead of recursing forever.
- Theme, accessibility, form-validation and i18n hooks initialise without effect cascades; i18n no longer refetches on every render.
- `ResourceLoader` renders children in lazy mode instead of hanging on "Loading resources...".
- The server serves the Vite build from `dist/` before falling back to `public/`.
- `scripts/cleanup.mjs` runs under ESM instead of crashing on `require`.

### Changed
- `value_sensitivity` contributes to pre-scoring, and the evaluation script uses the production scorer.
- Vitest caps its worker pool (`VITEST_MAX_WORKERS`) to avoid out-of-memory runs.
- Repository scratch artifacts were removed and `.gitignore` covers them.

### Added
- 32 regression tests covering the fixes above (suite now 318 tests).
- Documentation improvements and guides
- Comprehensive API endpoint reference
- Architecture diagrams and visualizations
- Performance optimization guide
- Security documentation and best practices
- Getting started guide for new developers
- Troubleshooting guide for common issues
- Deployment guide for production environments

### Changed
- Updated test count badges in README (156 → 93 tests)
- Corrected API path documentation (/api/v1/* → /api/*)
- Fixed deployment status messaging (API is live)
- Added comprehensive environment variable documentation
- Improved error response format documentation
- Updated authentication flow documentation

### Fixed
- README test count badge accuracy
- API path documentation inconsistencies
- Deployment status clarification
- Environment variable default values table
- Error response format consistency
- Rate limiting documentation
- Authentication endpoint documentation

## [0.0.0] - 2024-10-21

### Added
- Initial release of NaijaTaste AI
- ReAct agent chat functionality
- Restaurant recommendation system
- User authentication with JWT
- Google sign-in integration
- Restaurant search and filtering
- AI-generated reviews
- User preferences and personas
- Favorites system
- Rating and reporting system
- Admin dashboard
- Progressive Web App (PWA) support
- Map integration with Leaflet
- Responsive web interface

### Features
- **ReAct Agent Chat**: Gemini-powered reasoning with restaurant recommendations
- **Taste Persona**: City, budget, spice, and ambience extraction from chat
- **Nearby Search**: Location-based restaurant discovery with maps
- **Authentication**: JWT-based auth with refresh tokens and OTP reset
- **AI Reviews**: Personalized restaurant reviews based on user preferences
- **Deterministic Fallback**: Pre-scored recommendations when LLM is unavailable
- **Favorites**: Save and sync favorite restaurants across devices
- **Ratings & Reports**: User feedback and bug reporting system
- **Admin Panel**: System monitoring and user management
- **PWA**: Offline functionality and app-like experience

### Technical Stack
- **Runtime**: Node 24 with Express 4.19
- **Database**: PostgreSQL with Neon (dev: pg-mem)
- **AI**: Gemini API with fallback system
- **Frontend**: React 19, Vite 8, Leaflet maps
- **Auth**: JWT, bcrypt, Google OAuth
- **Email**: Nodemailer with SMTP
- **Testing**: Vitest, Playwright, ESLint
- **Deployment**: Vercel with serverless functions

### API Endpoints (31 total)
- Health checks: `/health`, `/health/ready`
- Authentication: `/auth/signup`, `/auth/signin`, `/auth/refresh`, `/auth/signout`, `/auth/me`, `/auth/google`, `/auth/forgot-password`, `/auth/reset-password`
- Discovery: `/nearby`, `/restaurants/geo`
- Agent & Chat: `/agent`, `/chat`, `/chat/:sessionId`
- Taste & Preferences: `/extract-persona`, `/update-preference`, `/recommend`, `/generate-review`
- Engagement: `/ratings`, `/reports`
- Admin: `/admin/stats`, `/admin/reports`, `/admin/reports/:ticket`
- Favorites: `/auth/favorites`
- Saved Places: `/auth/saved-places`

### Documentation
- README with setup instructions
- API reference documentation
- Contributing guidelines
- Project structure overview
- Environment configuration guide

## [0.0.0-beta.1] - 2024-09-15

### Added
- Basic project structure
- Initial Express API setup
- Database schema migrations
- User authentication system
- Restaurant data import from OSM
- Basic frontend components
- Development environment setup

### Changed
- Initial development phase

### Fixed
- Initial setup issues

## [0.0.0-alpha] - 2024-08-01

### Added
- Project concept and planning
- Technology stack selection
- Initial architecture design
- Database schema design
- API specification
- UI/UX mockups

### Changed
- Initial project setup

### Fixed
- Planning phase issues

---

## Versioning Information

### Version Format
- **Major (X.0.0)**: Incompatible API changes, major feature additions
- **Minor (0.Y.0)**: New features that are backward compatible
- **Patch (0.0.Z)**: Backward-compatible bug fixes and documentation updates

### Release Process
1. Update version in `package.json`
2. Update this changelog
3. Create release branch
4. Test all changes
5. Merge to main branch
6. Create release on GitHub
7. Deploy to production

### Breaking Changes
Any changes that break backward compatibility will be documented in this changelog with a clear explanation of:
- What changed
- Why it changed
- How to migrate
- When it was introduced

### Deprecation Policy
- Features will be deprecated with at least 2 versions notice
- Deprecated features will remain functional during deprecation period
- Migration guides will be provided
- Deprecated features will be removed in major version updates

---

## Contributing to Changelog

When making changes to the project:

1. **Add entries to the appropriate section** (Added, Changed, Fixed, Deprecated, Removed, Security)
2. **Be descriptive but concise** - explain what changed and why
3. **Include relevant issue numbers** if applicable
4. **Use the past tense** for all entries
5. **Update version numbers** when releasing new versions

### Changelog Entry Format

```
### Added
- New feature description with brief explanation
- Another new feature with more details if needed

### Changed
- Existing feature that was modified
- Configuration or behavior change

### Fixed
- Bug that was resolved
- Issue that was corrected

### Deprecated
- Feature that will be removed in future version
- Alternative solution provided

### Removed
- Feature that was completely removed
- Migration instructions if applicable

### Security
- Security vulnerability that was fixed
- Security improvement that was made
```

## Viewing Changelog

### Latest Changes
To see the most recent changes, check the [Unreleased] section.

### Specific Version
To see changes for a specific version, look for the corresponding version number (e.g., [0.0.0]).

### Release Notes
Each release includes:
- Summary of changes
- Migration guide (if needed)
- Known issues
- Future plans

## Support

For questions about specific changes or to report issues with the changelog:

1. Check the [GitHub Issues](https://github.com/hiamrhex/naijaste-ai/issues)
2. Search existing issues before creating new ones
3. Provide detailed information about your question or issue
4. Include relevant version numbers and environment details

---

## Historical Context

This changelog was created to provide a clear record of all changes to NaijaTaste AI. It serves as:

- A reference for users upgrading between versions
- Documentation for the development team
- A record of the project's evolution
- A tool for planning future development

The changelog follows industry best practices and is maintained to ensure transparency and accountability in the project's development process.