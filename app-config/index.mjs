import baseConfig from './base.json' with { type: 'json' };

const normalizeSlug = (input) =>
  input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');

const toCamelCase = (slug) =>
  slug
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((segment, index) =>
      index === 0
        ? segment.toLowerCase()
        : segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
    )
    .join('');

const ensureDisplayName = (displayName, slug) => {
  if (displayName && displayName.trim().length > 0) return displayName;
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export const createAppConfig = (base) => {
  const slug =
    base.slug && base.slug.trim().length > 0 ? base.slug : normalizeSlug(base.displayName ?? '');
  const normalizedSlug = normalizeSlug(slug);
  const camelCaseId = toCamelCase(normalizedSlug);
  const pascalCaseId = camelCaseId.charAt(0).toUpperCase() + camelCaseId.slice(1);
  const displayName = ensureDisplayName(base.displayName, normalizedSlug);
  const shortName =
    base.shortName && base.shortName.trim().length > 0
      ? base.shortName
      : displayName.replace(/\s+/g, '');
  const description = base.description ?? '';

  return {
    displayName,
    shortName,
    slug: normalizedSlug,
    description,
    camelCaseId,
    pascalCaseId,
    compactName: displayName.replace(/[^a-zA-Z0-9]+/g, ''),
    uppercaseSlug: normalizedSlug.toUpperCase(),
  };
};

const config = Object.freeze(createAppConfig(baseConfig));

export const appConfig = config;
export const displayName = config.displayName;
export const shortName = config.shortName;
export const slug = config.slug;
export const description = config.description;
export const camelCaseId = config.camelCaseId;
export const pascalCaseId = config.pascalCaseId;
export const compactName = config.compactName;
export const uppercaseSlug = config.uppercaseSlug;

export default config;
