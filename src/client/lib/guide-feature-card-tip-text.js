/**
 * Tooltip body text for V2 guide card chips ({@link GuideFeatureCardChips}).
 */

/**
 * @param {object} chip — engine chip (may include `description`)
 * @param {object} [featRow] — merged `activeFeatures` row
 * @param {string} resolvedLabel — chip display name (already resolved if `chip.name` was a function)
 * @returns {string}
 */
export function buildGuideCardChipTipText(chip, featRow, resolvedLabel) {
  const fromChip = typeof chip?.description === 'string' && chip.description.trim();
  const fromRow = typeof featRow?.description === 'string' && featRow.description.trim();
  return fromChip || fromRow || resolvedLabel;
}

/**
 * Tooltip body for an isSelect option or selectTargets row: option-specific text first,
 * then the parent feature description (markdown strings).
 * @param {string} [optionDesc]
 * @param {string} [featureDesc]
 * @returns {string}
 */
export function mergeOptionAndFeatureTooltipMarkdown(optionDesc, featureDesc) {
  const o = typeof optionDesc === 'string' ? optionDesc.trim() : '';
  const f = typeof featureDesc === 'string' ? featureDesc.trim() : '';
  if (o && f) return `${o}\n\n${f}`;
  return o || f || '';
}
