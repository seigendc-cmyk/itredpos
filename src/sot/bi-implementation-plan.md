# SCI POS BI Implementation Plan

## Purpose

This file translates the BI SOT documents into implementation direction for the POS codebase.

The BI implementation must be built in phases. The first production version should focus on event logging, stock integrity, stocktake intelligence, theft detection, COGS intelligence, profit protection, alerts, and the Business Intelligence Control Centre.

## Required Folder Structure

Create the following structure:

src/bi/
src/bi/events/
src/bi/rules/
src/bi/scoring/
src/bi/alerts/
src/bi/recommendations/
src/bi/predictions/
src/bi/dashboard/
src/bi/types/

## Core Code Modules

Required modules:

- biEventLogger
- biRulesEngine
- stockIntegrityEngine
- stocktakeIntelligenceEngine
- theftDetectionEngine
- cogsIntelligenceEngine
- profitProtectionEngine
- cashControlEngine
- staffIntelligenceEngine
- salesIntelligenceEngine
- purchaseIntelligenceEngine
- supplierIntelligenceEngine
- deliveryIntelligenceEngine
- customerIntelligenceEngine
- branchIntelligenceEngine
- riskScoringEngine
- alertsEngine
- recommendationEngine
- predictiveModelsEngine

## Firestore Collections

Required BI collections:

vendors/{vendorId}/biEvents
vendors/{vendorId}/biAlerts
vendors/{vendorId}/biScores
vendors/{vendorId}/biRecommendations
vendors/{vendorId}/biStocktakeTasks
vendors/{vendorId}/biSnapshots
vendors/{vendorId}/biInvestigations

## BI Event Requirements

Every major POS action must create a BI event.

Required event fields:

- eventId
- eventType
- vendorId
- branchId
- terminalId
- warehouseId
- staffId
- roleId
- timestamp
- sourceModule
- productId
- quantity
- costValue
- sellingValue
- beforeValue
- afterValue
- approvalStatus
- riskFlag

## Phase 1 Build

Phase 1 must implement:

- Event logger
- BI event types
- Stock integrity calculation
- Stock variance detection
- Risk-based stocktake task generation
- Basic theft detection rules
- Basic COGS margin rules
- Basic profit protection calculations
- Basic alerts engine
- Business Intelligence page shell

## Phase 2 Build

Phase 2 must implement:

- Staff risk scoring
- Supplier risk scoring
- Branch health scoring
- Cash control scoring
- Delivery intelligence scoring
- Customer intelligence scoring
- Recommendation engine
- BI filters
- BI search
- BI chapters

## Phase 3 Build

Phase 3 must implement:

- Predictive stockout logic
- Predictive theft risk logic
- Predictive margin collapse logic
- Predictive customer churn logic
- Predictive supplier risk logic
- Owner daily business brief

## Business Intelligence Page

Create a dedicated POS page named:

Business Intelligence

This page must include:

- Landing Dashboard
- Stock Integrity
- Stocktake Intelligence
- Theft Detection
- COGS
- Profit Protection
- Cash Control
- Staff Intelligence
- Sales Intelligence
- Purchases
- Suppliers
- Delivery
- Customers
- Branches
- Alerts
- Recommendations
- Predictive Intelligence

## UI Principle

The BI page must be understandable to ordinary vendors.

Each feed must show:

Observation
Reason
Risk
Recommended Action
Expected Benefit

## Strategic Priority

The first industrial-grade focus must be:

1. Stock theft detection
2. Stocktake intelligence
3. COGS intelligence
4. Profit protection
5. Cash control
6. Risk scoring
7. Alerts
8. Recommendations

SCI POS BI must protect the business from silent failure caused by stock theft, weak margins, cash leakage, poor purchasing, and uncontrolled operations.
