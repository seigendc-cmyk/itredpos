# Manual Dev SOT

## Manual Development Governance

### Source Identifier

Every manual build performed within the seiGEN Commerce Infrastructure shall use the following source identifier:

**Source:** USING MANUAL DEV

This identifier confirms that the implementation was produced through the approved Manual Development workflow rather than autonomous agent execution.

### Mandatory Build Header

Every PowerShell build prompt shall begin with:

- Build Number
- Build Name
- Source: USING MANUAL DEV

### Mandatory Build Workflow

Every build shall follow this sequence:

1. git status
2. Modify only the intended source file or files
3. npm run build
4. Review git diff
5. git add
6. git commit
7. git push
8. Verify git status returns a clean working tree

No build may be considered complete until the repository is clean.

### Build Commit Standard

Commit messages shall follow this format:

Build <Number>: <Feature Description>

Example:

Build 2K-13B: add transformation input cost capture

### Runtime Protection Rule

A build introducing runtime errors shall not be followed by new feature builds.

Runtime issues must first be corrected through a dedicated Runtime Repair Build before feature development resumes.

### SOT Compliance

All future PowerShell prompts generated from this Manual Dev SOT shall comply with these governance rules.
