export interface MappingConfig {
	lookupField: string;
	onNotFound: "error" | "ignore" | "create";
	defaults?: Record<string, any>;
}

export interface CLIConfig {
	mappings: Record<string, MappingConfig | undefined>;
}

import type { Action } from "./commands";
export type { Action } from "./commands";

export interface CommandArgs {
	collection: string;
	action: Action;
	data: any;
}
