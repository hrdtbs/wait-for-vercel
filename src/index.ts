import * as core from "@actions/core";
import * as github from "@actions/github";
import axios from "axios";

const waitForUrl = async (url: string, maxTimeout: number) => {
  const iterations = maxTimeout / 2;
  for (let i = 0; i < iterations; i++) {
    try {
      await axios.get(url);
      return;
    } catch (e) {
      console.log("Url unavailable, retrying...");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  core.setFailed(`Timeout reached: Unable to connect to ${url}`);
};

const waitForStatus = async (
  {
    token,
    owner,
    repo,
    deployment_id,
  }: {
    token: string;
    owner: string;
    repo: string;
    deployment_id: number;
  },
  maxTimeout: number
) => {
  const octokit = new github.GitHub(token);
  const iterations = maxTimeout / 2;

  for (let i = 0; i < iterations; i++) {
    try {
      const statuses = await octokit.repos.listDeploymentStatuses({
        owner,
        repo,
        deployment_id,
      });

      const status = statuses.data.length > 0 && statuses.data[0];

      if (!status) {
        throw Error("No status was available");
      } else if (status && status.state !== "success")
        throw Error('No status with state "success" was available');
      if (status && status.state === "success") {
        return status;
      } else {
        throw Error("Unknown status error");
      }
    } catch (e) {
      console.log("Deployment unavailable or not successful, retrying...");
      console.log(e);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  core.setFailed(
    `Timeout reached: Unable to wait for an deployment to be successful`
  );
};

const run = async () => {
  try {
    const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN", { required: true });
    const MAX_TIMEOUT = 60 * 10;
    if (!GITHUB_TOKEN) {
      core.setFailed("Required field `GITHUB_TOKEN` was not provided");
    }

    const octokit = new github.GitHub(GITHUB_TOKEN);

    const context = github.context;
    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const PR_NUMBER = github.context.payload.pull_request?.number;

    if (PR_NUMBER === undefined) {
      core.setFailed("No pull request number was found");
      return;
    }
    const currentPR = await octokit.pulls.get({
      owner,
      repo,
      pull_number: PR_NUMBER,
    });

    if (currentPR.status !== 200) {
      core.setFailed(
        "Could not get information about the current pull request"
      );
    }

    const prSHA = currentPR.data.head.sha;

    const deployments = await octokit.repos.listDeployments({
      owner,
      repo,
      sha: prSHA,
    });

    const deployment = deployments.data.length > 0 && deployments.data[0];

    if (deployment === false) {
      core.setFailed("No development data was found");
      return;
    }

    const status = await waitForStatus(
      {
        owner,
        repo,
        deployment_id: deployment.id,
        token: GITHUB_TOKEN,
      },
      MAX_TIMEOUT
    );

    const targetUrl = status?.target_url;

    if (targetUrl === undefined) {
      core.setFailed("No target url was found");
      return;
    }

    console.log("target url »", targetUrl);

    core.setOutput("target_url", targetUrl);

    console.log(`Waiting for a status code 200 from: ${targetUrl}`);
    await waitForUrl(targetUrl, MAX_TIMEOUT);
  } catch (error) {
    console.error(error.message)
    core?.setFailed(error.message);
  }
};

run();
