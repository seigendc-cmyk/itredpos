# Commerce BI SOT v1.0

Commerce BI is the passive intelligence layer of the seiGEN Commerce Operating System.

BI consumes commerce events and produces dashboards, alerts, scoring, reports, and decision signals.

BI must never directly mutate operational records in POS, iDeliver, Vendor Discovery, Console, Licensing, or other application modules.

## BI Domains

### Sales BI
Tracks:
- revenue
- gross profit
- gross margin
- cashier performance
- branch performance
- terminal performance
- discounts
- refunds
- VAT and tax-ready sales totals
- hourly, daily, weekly, and monthly sales trends

### Inventory BI
Tracks:
- stock movement
- stock ageing
- dead stock
- fast movers
- slow movers
- overstock
- understock
- negative stock attempts
- supplier performance
- warehouse and branch stock discipline

### Product Transformation BI
Tracks:
- raw-to-finished goods conversion
- yield
- waste
- shrinkage
- transformation cost
- transformation profit
- production variance
- batch accountability

### Marketing BI
Tracks:
- product views
- catalogue views
- WhatsApp clicks
- enquiries
- repeat purchase behaviour
- dormant customers
- basket patterns
- campaign performance
- customer retention signals

### Delivery BI
Tracks:
- delivery request time
- driver acceptance time
- pickup time
- delivery duration
- GPS updates
- route behaviour
- failed delivery attempts
- secret-code fulfillment confirmations
- cash collected by delivery staff
- driver scoring

### Operations BI
Tracks:
- staff logins
- branch activity
- terminal usage
- shift openings
- shift closings
- cash variance
- approvals
- overrides
- suspicious behaviour
- audit risk events

### Customer BI
Tracks:
- purchase frequency
- average spend
- customer lifetime value
- payment preference
- preferred product categories
- churn risk
- repeat buying cycles
- customer segmentation

## BI Rule

BI may write to BI-specific collections only, such as:
- biSalesMetrics
- biInventoryMetrics
- biTransformationMetrics
- biMarketingMetrics
- biDeliveryMetrics
- biOperationsMetrics
- biCustomerMetrics
- biRiskScores
- biAlerts

BI must not write directly to:
- sales
- saleItems
- stock
- products
- shifts
- deliveries
- customers
- licenses
- payments
- operational source records
