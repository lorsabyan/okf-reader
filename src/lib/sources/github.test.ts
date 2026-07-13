import { describe, expect, test } from 'bun:test';
import { parseGithubUrl } from './github';

describe('parseGithubUrl', () => {
  test('owner/repo shorthand', () => {
    expect(parseGithubUrl('lorsabyan/okf-skill')).toEqual({
      owner: 'lorsabyan',
      repo: 'okf-skill',
      branch: undefined,
      subdir: '',
    });
  });

  test('full URL with branch and subdir', () => {
    expect(parseGithubUrl('https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf/bundles/ga4')).toEqual({
      owner: 'GoogleCloudPlatform',
      repo: 'knowledge-catalog',
      branch: 'main',
      subdir: 'okf/bundles/ga4',
    });
  });

  test('tolerates trailing slash, .git suffix, and www', () => {
    expect(parseGithubUrl('https://www.github.com/foo/bar.git/')).toMatchObject({ owner: 'foo', repo: 'bar' });
  });

  test('rejects garbage', () => {
    expect(parseGithubUrl('not a url at all !!!')).toBeNull();
  });
});
