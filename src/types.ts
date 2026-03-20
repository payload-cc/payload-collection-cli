export interface MappingConfig {
  lookupField: string;
  onNotFound?: 'error' | 'ignore' | 'create';
}

export interface CLIConfig {
  mappings: Record<string, MappingConfig>;
}

export type Action = 'create' | 'update' | 'delete' | 'find' | 'upsert';

export interface CommandArgs {
  collection: string;
  action: Action;
  data: any;
}
