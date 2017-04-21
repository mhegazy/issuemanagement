import GitHubApi = require("github");
import settings = require("./settings");
import token = require("./token");
import fs = require("fs");
import path = require("path");

const repo = { owner: settings.owner, repo: settings.repo };
const cutoffDate = new Date((new Date()).getTime() - (settings.dayesSinceLastEdit * 24 * 60 * 60 * 1000));
const maxProcessedIssues = settings.maxProcessedIssues > 0 ? settings.maxProcessedIssues : Infinity;
const maxClosedIssues = settings.maxClosedIssues > 0 ? settings.maxClosedIssues : Infinity;

function stringify(o: any) {
    return JSON.stringify(o, undefined, 2);
}

async function closeIssues() {
    const issuesClosed: Issue[] = [];
    const commentsAdded: Comment[] = [];
    const issuesClosedByLabel: { [x: string]: number; } = {};
    let issuesClosedCount = 0;

    let processedIssues = 0;

    // Create log location
    const baseLogFolder = path.join(__dirname, settings.logFolder);
    if (!fs.existsSync(baseLogFolder)) {
        fs.mkdirSync(baseLogFolder);
    }
    const logFolder = path.join(baseLogFolder, `${new Date().getTime()}`)
    fs.mkdirSync(logFolder);

    console.log();
    console.log(`Writing logs to ${logFolder}`);

    console.log();
    console.log(`Settings: `);
    console.log(stringify(settings));

    const github = new GitHubApi({
        // optional
        debug: settings.debug,
        protocol: "https",
        host: "api.github.com", // should be api.github.com for GitHub
        pathPrefix: "", // for some GHEs; none for GitHub
        headers: {
            "user-agent": "node.js" // GitHub is happy with a unique user agent
        },
        followRedirects: false, // default: true; there's currently an issue with non-get redirects, so allow ability to disable follow-redirects
        timeout: 5000
    });

    // Authenticate
    github.authenticate({
        type: "token",
        token: token,
    });

    try {
        await processPages();
    }
    finally {

        if (!settings.dry) {
            fs.writeFileSync(path.join(logFolder, "issuesClosed.json"), stringify(issuesClosed));
            fs.writeFileSync(path.join(logFolder, "commentsAdded.json"), stringify(commentsAdded));
        }

        console.log();
        console.log(`Processed Issues: ${processedIssues}`);
        console.log(`Issues Closed: ${issuesClosedCount}`);
        for (const label in issuesClosedByLabel) {
            console.log(`   ${label}: ${issuesClosedByLabel[label]}`);
        }
    }

    async function processPages() {
        let issues: Issue[] & Response | undefined;
        let processedPages = 0;

        while (true) {
            processedPages++;

            if (!issues) {
                issues = await github.issues.getForRepo({ ...repo, state: "open" });
            }
            else if (github.hasNextPage(issues)) {
                issues = await github.getNextPage(issues);
            }
            else {
                break;
            }

            if (settings.debug) {
                console.log();
                console.log(`--- Page ${processedPages}:`);
                console.log(stringify(issues));
            }

            if (!issues || !issues.length) {
                console.log();
                console.log("Found no more open issues!");
                break;
            }

            console.log();
            console.log(`Processing page ${processedPages}, found ${issues.length} issues...`);

            const done = await processPage(issues);

            console.log(`Done procesing page ${processedPages}.`);

            if (done) {
                break;
            }
        }
    }

    async function processPage(issues: Issue[]) {
        for (const issue of issues) {
            processedIssues++;
            if (processedIssues >= maxProcessedIssues) {
                console.log();
                console.log(`== Reached maximum. Already processed: ${processedIssues}. Max is: ${maxProcessedIssues}.`);
                return true;
            }

            if (issuesClosedCount >= maxClosedIssues) {
                console.log();
                console.log(`== Reached maximum. Already closed: ${issuesClosedCount}. Max is: ${maxClosedIssues}.`);
                return true;
            }

            if (settings.debug) {
                console.log();
                console.log(`== ${processedIssues}. Processing issue #${issue.number}...`);
            }

            if (issue.assignee) {
                if (settings.debug) {
                    console.log(`==== Issue assigned to @${issue.assignee.login}, skipping.`);
                }
                continue;
            }

            if (issue.updated_at && new Date(issue.updated_at) > cutoffDate) {
                if (settings.debug) {
                    console.log(`==== Issue last updated on ${new Date(issue.updated_at)}, skipping.`);
                }
                continue;
            }

            if (!issue.labels.length) {
                if (settings.debug) {
                    console.log(`==== Issue has no labels, skipping.`);
                }
                continue;
            }

            if (!issue.labels.every(l => settings.labelsToClose.indexOf(l.name) >= 0)) {
                if (settings.debug) {
                    console.log(`==== Issue has unkown labels: ${(issue.labels.map(l => l.name)).join(",")}, skipping.`);
                }
                continue;
            }

            if (settings.closeMessage) {
                console.log(`==== Adding comment...`);
                if (!settings.dry) {
                    // Add it
                    const comment: Response & Comment = await github.issues.createComment({ ...repo, number: issue.number, body: settings.closeMessage });
                    // Record it
                    commentsAdded.push(comment);
                    // Log it
                    if (settings.debug) {
                        console.log("--- Comment: ");
                        console.log(stringify(comment));
                    }
                    // Verify it
                    if (!comment || !comment.meta || comment.meta.status !== "201 Created") {
                        console.log(`==== Failed to add comment: ${stringify(comment)}, skipping.`);
                        continue;
                    }
                }
            }

            console.log(`==== Closing issue #${issue.number}...`);
            if (!settings.dry) {
                // Close it
                const result: Response & Issue = await github.issues.edit({ ...repo, number: issue.number, state: "closed" });
                // Record it
                issuesClosed.push(result);
                // Log it
                if (settings.debug) {
                    console.log("--- Issue Closed: ");
                    console.log(stringify(result));
                }
                // Verify it
                if (!result || !result.meta || result.meta.status !== "200 OK") {
                    console.log(`==== Closing failed: ${stringify(result)}.`);
                    continue;
                }
            }
            issuesClosedCount++;
            issue.labels.forEach(l => {
                issuesClosedByLabel[l.name] = issuesClosedByLabel[l.name] ? (issuesClosedByLabel[l.name] + 1) : 1;
            });

            if (settings.debug) {
                console.log(`== Done!`);
            }

        }
        return false;
    }
}

closeIssues();

