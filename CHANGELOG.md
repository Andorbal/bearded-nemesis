# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- [E2E Tests for Login, Setlist Creation, and Playthrough Start Flow](docs/completed/2025-12-16-feature-e2e-pre-playthrough) - Comprehensive Playwright tests covering the complete user journey from login through starting a playthrough, providing foundation for playthrough stats entry tests

### Fixed
- Database schema now allows same user to play multiple instruments in one playthrough (migration 006) - fixes 400 error when solo player selects 2+ instruments
