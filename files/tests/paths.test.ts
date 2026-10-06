import { describe, expect, it } from 'vitest';

import { configFile, dataDir, nodeCandidates } from '../hooks/lib/paths.ts';

describe('paths', () => {
  it('keeps the data in a folder of its own, under the home folder', () => {
    expect(dataDir({ name: 'my-mod', home: '/h' })).toBe('/h/.claude/mod-data/my-mod');
    expect(configFile('/h/data')).toBe('/h/data/config.json');
  });

  it('looks for Node on the PATH first, then in the usual places', () => {
    expect(nodeCandidates('/h')[0]).toBe('node');
    expect(nodeCandidates('/h')).toContain('/h/.volta/bin/node');
  });
});
