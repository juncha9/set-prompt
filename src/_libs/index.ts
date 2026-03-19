export const isGitUrl = (source: string): boolean => (
    source.startsWith('http://') ||
    source.startsWith('https://') ||
    source.startsWith('git@') ||
    source.startsWith('ssh://') ||
    (source.endsWith('.git') && (source.startsWith('http') || source.startsWith('git@') || source.startsWith('ssh://')))
);
