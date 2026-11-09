
import { calculateSeverity } from '@/lib/riskScoring';
test('severity mapping', ()=>{
  expect(calculateSeverity(20)).toBe('critical');
  expect(calculateSeverity(12)).toBe('high');
  expect(calculateSeverity(6)).toBe('medium');
  expect(calculateSeverity(2)).toBe('low');
});
