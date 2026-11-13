export type ApplicationType = "web" | "api" | "hybrid";
export interface ApplicationConfig {
  id: string; name: string; type: ApplicationType; baseUrl: string; description?: string;
  authentication?: { type: "none" | "basic" | "bearer" | "form" | "custom"; usernameEnv?: string; passwordEnv?: string; tokenEnv?: string; loginPath?: string; };
  browser?: { headless?: boolean; timeoutMs?: number; };
  api?: { defaultHeaders?: Record<string, string>; };
}
export interface FrameworkOptions { appId: string; configPath: string; requirementPath: string; outputDir: string; }
export interface DiscoveryElement {
  id: string; tag: string; role: string; text: string; label: string; placeholder: string;
  inputType: string; name: string; elementId: string; href: string;
}
export interface DiscoveryEvidence {
  applicationId: string; baseUrl: string; inspectedAt: string;
  pages: Array<{
    url: string; title: string; headings: string[];
    links: Array<{ text: string; href: string }>;
    forms: Array<{ name: string; fields: Array<{ name: string; type: string; label: string }> }>;
    buttons: string[]; elements: DiscoveryElement[];
  }>;
}