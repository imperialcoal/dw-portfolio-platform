export interface RepoFile {
  path: string;
  content: string;
}

export interface RepoStructure {
  /** Flat list of all file paths in the repo */
  allPaths: string[];
  /** Contents of key files the LLM needs to generate accurate docs */
  keyFiles: RepoFile[];
  /** The current branch scanned */
  branch: string;
  /** ISO timestamp of the scan */
  scannedAt: string;
}
