# SCI Branch Governance SOT

**Owner:** Digital Commerce (Private) Limited  
**Status:** Controlled Source of Truth  

## Standard branches

- main
- develop
- integration/*
- feature/*
- fix/*
- security/*
- release/*
- hotfix/*

## Rules

- Do not develop directly on main.
- Review branch commits before merging.
- Run validation after every merge.
- Do not delete a branch before useful work is merged, extracted or archived.
- Do not use blanket conflict-resolution decisions on critical files.
- Create recovery references before major consolidation work.

## Naming examples

feature/branch-stock-transfer

fix/terminal-session-restore

security/firestore-tenant-isolation

release/v0.8.0-alpha.1
