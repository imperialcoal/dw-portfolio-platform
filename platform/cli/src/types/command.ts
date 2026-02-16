export type CLICommand = () => Promise<unknown>;

export interface CLICommandModule {
  default: CLICommand;
  description?: string;
}
