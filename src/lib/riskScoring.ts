
// Documented & configurable scoring
// Inherent Score = Likelihood (1-5) * Impact (1-5) = 1-25
// Severity: 1-4 Low, 5-9 Medium, 10-16 High, 17-25 Critical
// Residual Score = Residual Likelihood * Residual Impact, after mitigation
// Mitigation effectiveness = Inherent - Residual
export function calculateSeverity(score:number){
  if(score>=17) return 'critical';
  if(score>=10) return 'high';
  if(score>=5) return 'medium';
  return 'low';
}
export function residualScore(likelihood:number, impact:number, mitigationPct:number){
  // mitigationPct 0-100 reduces score proportionally
  const inherent = likelihood*impact;
  return Math.max(1, Math.round(inherent * (1 - mitigationPct/100)));
}
