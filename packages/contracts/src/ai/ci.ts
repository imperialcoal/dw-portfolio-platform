export interface GitHubJob {
  name: string;
  conclusion: string | null;
  steps?: { name: string; conclusion: string | null; number: number }[];
}
