
export interface ZapEnvironmentInfo {
  available: boolean;
  engine: "docker" | "local" | "none";
  version?: string;
  image?: string;
  command?: string;
  details: string;
  dockerAvailable: boolean;
  dockerRunning: boolean;
  dockerImageAvailable: boolean;
  localZapAvailable: boolean;
  localZapPath?: string;
}

export interface SecurityTargetSafetyValidation {
  safe: boolean;
  targets: string[];
  blockedTargets: string[];
  activeScanDetected: boolean;
  reason?: string;
}

export interface SecurityTargetSafetyOptions {
  allowedTargets?: string[];
  allowExternal?: boolean;
  allowActive?: boolean;
}

// ZAP Automation Framework schema interfaces
export interface ZapContextConfig {
  name: string;
  urls: string[];
  includePaths?: string[];
  excludePaths?: string[];
}

export interface ZapPlanEnv {
  contexts: ZapContextConfig[];
  parameters?: {
    failOnError?: boolean;
    failOnWarning?: boolean;
    progressToStdout?: boolean;
  };
}

export interface ZapPlanJob {
  type: string;
  name?: string;
  parameters?: Record<string, unknown>;
}

export interface ZapAutomationPlan {
  env: ZapPlanEnv;
  jobs: ZapPlanJob[];
}

// ZAP JSON Report Schema (traditional-json format)
export interface ZapRawAlertInstance {
  uri?: string;
  method?: string;
  param?: string;
  attack?: string;
  evidence?: string;
  otherinfo?: string;
}

export interface ZapRawAlert {
  pluginid: string;
  alert: string;
  name?: string;
  riskcode: string;
  confidence: string;
  riskdesc: string;
  desc?: string;
  solution?: string;
  reference?: string;
  cweid?: string;
  wascid?: string;
  instances?: ZapRawAlertInstance[];
  count?: string;
}

export interface ZapRawSite {
  "@name": string;
  "@host": string;
  "@port": string;
  "@ssl": string;
  alerts?: ZapRawAlert[];
}

export interface ZapRawReport {
  "@version"?: string;
  "@generated"?: string;
  site?: ZapRawSite[] | ZapRawSite;
}
