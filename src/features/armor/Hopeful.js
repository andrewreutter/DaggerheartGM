export default {
  name: 'Hopeful',
  description: 'When you would spend Hope, you can mark an Armor Slot instead.',
  // No automation hook: Hope-spend interception is in GMTableView/applyFeatureResources and chip resolve;
  // when roll._hopefulArmorInsteadByInstanceId[instanceId] is set, we mark armor instead of spending Hope.
};
