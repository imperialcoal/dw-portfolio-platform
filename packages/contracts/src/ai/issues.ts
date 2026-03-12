export interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  permalink: string;
  firstSeen: string;
  lastSeen: string;
  count: string;
  userCount: number;
  project: {
    slug: string;
    name: string;
  };
}

export interface SentryIssueDetail extends SentryIssue {
  metadata: {
    type?: string;
    value?: string;
    filename?: string;
  };
  tags: { key: string; value: string }[];
}
