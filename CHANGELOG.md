# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Sections are generated automatically by `.github/workflows/release.yml` on each push to `production`.

## [0.0.22] - 2026-09-02

### Features
- add long-term savings goals API (#50)
- skip AI re-categorization for already-prefixed expense lines Expense lines with an in-file  prefix are now grouped directly under their canonical key instead of being re-sent to AI at cron/manual-send time. Only genuinely unassigned lines go to DeepSeek, along with a totals-only hint of the pre-categorized amounts so savingsMessage still reflects the full picture. - Preserve categoryKey through parseExpenseFile() instead of stripping it - Add splitExpensesByAssignment() as the single source of truth for merging   deterministic and AI-assigned categories, shared by the email reconciler   and the stored analytics snapshot - Allow an empty AI categorization response when nothing is left to assign Reduces AI credit usage for well-categorized months and stops AI from silently overriding a user's own category choice.

## [0.0.21] - 2026-08-26

### Features
- treat Investments as saving in analytics and summary email (#48)

## [0.0.20] - 2026-08-20

### Features
- persist an optional extra expense on the monthly budget (#46)

## [0.0.19] - 2026-08-19

### Features
- add reusable monthly category budget API (#44)
- automate CHANGELOG.md on production releases (#43)

### Other
- chore: retrigger production release
- add changelog to pipeline
