# USING MANUAL DEV

## Purpose

This file defines the official source marker for manual development work inside the seiGEN Commerce Infrastructure and iTredPOS build workflow.

## Official Source Marker

Source: USING MANUAL DEV

## Meaning

USING MANUAL DEV means the build was applied through controlled manual PowerShell terminal prompts under the Manual Dev SOT workflow.

It confirms that the build was not applied through uncontrolled autonomous agent execution.

## Mandatory Use

Every manual PowerShell build prompt must include:

- USING MANUAL DEV SOT
- Build number
- Build name
- Source: USING MANUAL DEV

## Required Build Discipline

Every manual build must follow this sequence:

1. git status
2. Modify only the intended source file or files
3. npm run build
4. git diff review
5. git add
6. git commit
7. git push
8. final git status clean check

## Runtime Safety Rule

If a runtime error appears after a build, feature work must stop.

A Runtime Repair Build must be completed, committed, and pushed before new feature builds continue.

## Current Approved Branch Context

Primary active branch for current controlled builds:

build-2k-product-transformation-tab

## Governance Status

This file is an active governance file and shall be treated as part of the development source of truth.
