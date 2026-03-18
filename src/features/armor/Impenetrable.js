export default {
  name: 'Impenetrable',
  description: 'When you would mark your last Hit Point, you can mark a Stress instead. Once per rest.',
  // Substitution is applied in applyDamageToTarget when useImpenetrable and conditions hold:
  // hpLoss reduced so target ends at 1 HP, 1 Stress marked, featureUsage['Impenetrable'] = { used: true, cycle: 'rest' }.
};
