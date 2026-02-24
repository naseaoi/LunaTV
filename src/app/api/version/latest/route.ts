import { NextResponse } from 'next/server';

import {
  buildChangelogUrls,
  buildVersionUrls,
  getUpdateBranch,
  getUpdateRepos,
} from '@/lib/update_source';

export const runtime = 'nodejs';

interface RemoteChangelogEntry {
  version: string;
  date: string;
  added: string[];
  changed: string[];
  fixed: string[];
}

function parseChangelog(content: string): RemoteChangelogEntry[] {
  const lines = content.split('\n');
  const versions: RemoteChangelogEntry[] = [];
  let currentVersion: RemoteChangelogEntry | null = null;
  let currentSection: 'added' | 'changed' | 'fixed' | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    const versionMatch = trimmedLine.match(
      /^## \[([\d.]+)\] - (\d{4}-\d{2}-\d{2})$/,
    );
    if (versionMatch) {
      if (currentVersion) {
        versions.push(currentVersion);
      }

      currentVersion = {
        version: versionMatch[1],
        date: versionMatch[2],
        added: [],
        changed: [],
        fixed: [],
      };
      currentSection = null;
      continue;
    }

    if (!currentVersion) {
      continue;
    }

    if (trimmedLine === '### Added') {
      currentSection = 'added';
      continue;
    }

    if (trimmedLine === '### Changed') {
      currentSection = 'changed';
      continue;
    }

    if (trimmedLine === '### Fixed') {
      currentSection = 'fixed';
      continue;
    }

    if (trimmedLine.startsWith('- ') && currentSection) {
      const entry = trimmedLine.substring(2).trim();
      if (!entry) {
        continue;
      }
      currentVersion[currentSection].push(entry);
    }
  }

  if (currentVersion) {
    versions.push(currentVersion);
  }

  return versions;
}

async function fetchVersionFromUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      return null;
    }

    const text = await response.text();
    const version = text.trim();
    return version || null;
  } catch {
    return null;
  }
}

async function fetchChangelogFromUrl(
  url: string,
): Promise<RemoteChangelogEntry[] | null> {
  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      return null;
    }

    const content = await response.text();
    const parsed = parseChangelog(content);
    return parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const repos = getUpdateRepos();
  const branch = getUpdateBranch();

  let latestVersion: string | null = null;
  let changelog: RemoteChangelogEntry[] = [];

  for (const url of buildVersionUrls()) {
    latestVersion = await fetchVersionFromUrl(url);
    if (latestVersion) {
      break;
    }
  }

  for (const url of buildChangelogUrls()) {
    const parsed = await fetchChangelogFromUrl(url);
    if (parsed) {
      changelog = parsed;
      break;
    }
  }

  return NextResponse.json(
    {
      latestVersion,
      changelog,
      sources: {
        repos,
        branch,
      },
      checkedAt: Date.now(),
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    },
  );
}
