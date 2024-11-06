const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      core.setFailed('GITHUB_TOKEN is required');
      return;
    }

    const { context } = github;
    const commitStatus = context.payload;
    const statusUrl = commitStatus.target_url;
    const state = commitStatus.state;
    const repoName = context.repo.repo;
    const owner = context.repo.owner;
    const sha = commitStatus.sha;

    // Check if the URL starts with "https://builds.gradle.org"
    if (!statusUrl || !statusUrl.startsWith("https://builds.gradle.org")) {
      console.log("URL does not start with 'https://builds.gradle.org'. Exiting.");
      return;
    }

    // Initialize GitHub client
    const octokit = github.getOctokit(token);

    // Define base scan URL
    const baseScanUrl = `https://ge.gradle.org/scans?search.names=gitCommitId&search.rootProjectNames=${repoName}`;

    if (state === 'success') {
      // Check for existing "BuildScanAll" status
      const { data: existingStatuses } = await octokit.repos.getCombinedStatusForRef({
        owner,
        repo: repoName,
        ref: sha,
      });
      const buildScanAllExists = existingStatuses.statuses.some(status => status.context === "BuildScanAll");

      if (!buildScanAllExists) {
        const scanUrl = `${baseScanUrl}&search.values=${sha}`;
        await octokit.repos.createCommitStatus({
          owner,
          repo: repoName,
          sha,
          state: "success",
          context: "BuildScanAll",
          description: "Build Scan (All)",
          target_url: scanUrl,
        });
        console.log("Published 'BuildScanAll' status.");
      }
    } else if (state === 'failure') {
      // Check for existing "BuildScanFailure" status
      const { data: existingStatuses } = await octokit.repos.getCombinedStatusForRef({
        owner,
        repo: repoName,
        ref: sha,
      });
      const buildScanFailureExists = existingStatuses.statuses.some(status => status.context === "BuildScanFailure");

      if (!buildScanFailureExists) {
        const scanUrl = `${baseScanUrl}&search.buildOutcome=failure&search.values=${sha}`;
        await octokit.repos.createCommitStatus({
          owner,
          repo: repoName,
          sha,
          state: "failure",
          context: "BuildScanFailure",
          description: "Build Scan (Failure)",
          target_url: scanUrl,
        });
        console.log("Published 'BuildScanFailure' status.");
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
