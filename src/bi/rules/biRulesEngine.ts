import type { BIAlert, BIEvent, BIRecommendation } from "../types/biTypes";

export interface BIRuleResult {
  alerts: BIAlert[];
  recommendations: BIRecommendation[];
}

export type BIRule = {
  ruleId: string;
  ruleName: string;
  domain:
    | "STOCK"
    | "STOCKTAKE"
    | "THEFT"
    | "COGS"
    | "PROFIT"
    | "CASH"
    | "STAFF"
    | "SALES"
    | "PURCHASE"
    | "SUPPLIER"
    | "DELIVERY"
    | "CUSTOMER"
    | "BRANCH";

  evaluate: (events: BIEvent[]) => BIRuleResult;
};

export function runBIRules(events: BIEvent[], rules: BIRule[]): BIRuleResult {
  return rules.reduce<BIRuleResult>(
    (result, rule) => {
      const ruleResult = rule.evaluate(events);

      return {
        alerts: [...result.alerts, ...ruleResult.alerts],
        recommendations: [
          ...result.recommendations,
          ...ruleResult.recommendations,
        ],
      };
    },
    {
      alerts: [],
      recommendations: [],
    }
  );
}
