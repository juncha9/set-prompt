import { repoCommitCommand } from './commit-command';
import { repoPushCommand } from './push-command';

export interface RepoSaveOptions {
    /** Commit message. When omitted, auto-generated from changed filenames. */
    message?: string;
}

/**
 * Convenience macro: add + commit + push in one step.
 * Aborts push if commit fails.
 */
export const repoSaveCommand = (options: RepoSaveOptions = {}): void => {
    const committed = repoCommitCommand({ message: options.message });
    if (committed === false) return;

    repoPushCommand();
};
