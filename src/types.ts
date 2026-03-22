export interface MappingConfig {
	lookupField: string;
	onNotFound: "error" | "ignore" | "create";
	defaults?: Record<string, any>;
}

export interface CLIConfig {
	mappings: Record<string, MappingConfig | undefined>;
}

export type Action = "create" | "update" | "delete" | "find" | "upsert";

export interface CommandArgs {
	collection: string;
	action: Action;
	data: any;
}
