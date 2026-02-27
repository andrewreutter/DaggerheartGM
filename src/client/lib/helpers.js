export const generateId = () => crypto.randomUUID();

export const parseFeatureCategory = (feature) => {
  if (!feature.description) return 'Actions';
  const desc = feature.description;
  if (/spend.*fear/i.test(desc) || /mark.*fear/i.test(desc)) return 'Fear Actions';
  if (feature.type === 'reaction') return 'Reactions';
  if (feature.type === 'passive') return 'Passives';
  return 'Actions';
};

export const hideImgOnError = (e) => { e.target.parentElement.style.display = 'none'; };
