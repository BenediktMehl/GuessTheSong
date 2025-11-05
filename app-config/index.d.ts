export interface AppConfig {
  displayName: string;
  shortName: string;
  slug: string;
  description: string;
  camelCaseId: string;
  pascalCaseId: string;
  compactName: string;
  uppercaseSlug: string;
}

export interface AppConfigInput {
  displayName?: string;
  shortName?: string;
  slug?: string;
  description?: string;
}

export declare const appConfig: AppConfig;
export declare const createAppConfig: (base: AppConfigInput) => AppConfig;

export declare const displayName: string;
export declare const shortName: string;
export declare const slug: string;
export declare const description: string;
export declare const camelCaseId: string;
export declare const pascalCaseId: string;
export declare const compactName: string;
export declare const uppercaseSlug: string;

export default appConfig;
