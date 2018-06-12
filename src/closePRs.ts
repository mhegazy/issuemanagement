import fs from "fs";
import GitHubApi from "github";
import path from "path";
import settings from "./settings.json";
import token from "./token.json";

const repo = { owner: settings.owner, repo: settings.repo };
const cutoffDate = new Date((new Date()).getTime() - (settings.pr.dayesSinceLastEdit * 24 * 60 * 60 * 1000));
const maxProcessedItems = settings.pr.maxProcessed > 0 ? settings.pr.maxProcessed : Infinity;
const maxClosedItems = settings.pr.maxClosed > 0 ? settings.pr.maxClosed : Infinity;

function stringify(o: any) {
    return JSON.stringify(o, undefined, 2);
}

async function closePRs() {
    const itemsClosed: PullRequest[] = [];
    const commentsAdded: Comment[] = [];
    let closedItemCount = 0;
    let processedItems = 0;

    // Create log location
    const baseLogFolder = path.join(__dirname, settings.logFolder);
    if (!fs.existsSync(baseLogFolder)) {
        fs.mkdirSync(baseLogFolder);
    }
    const basePRLogFolder = path.join(baseLogFolder, "pr");
    if (!fs.existsSync(basePRLogFolder)) {
        fs.mkdirSync(basePRLogFolder);
    }
    const logFolder = path.join(basePRLogFolder, `${new Date().getTime()}`)
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
            fs.writeFileSync(path.join(logFolder, "closed.json"), stringify(itemsClosed));
            fs.writeFileSync(path.join(logFolder, "commentsAdded.json"), stringify(commentsAdded));
        }

        console.log();
        console.log(`Processed Pull Requests: ${processedItems}`);
        console.log(`Pull Requests Closed: ${closedItemCount}`);
    }

    async function processPages() {
        let items: PullRequest[] & Response | undefined;
        let processedPages = 0;

        while (true) {
            processedPages++;

            if (!items) {
                items = await github.pullRequests.getAll({ ...repo, state: "open" });
            }
            else if (github.hasNextPage(items)) {
                items = await github.getNextPage(items);
            }
            else {
                break;
            }

            if (settings.debug) {
                console.log();
                console.log(`--- Page ${processedPages}:`);
                console.log(stringify(items));
            }

            if (!items || !items.length) {
                console.log();
                console.log("Found no more open pull requests!");
                break;
            }

            console.log();
            console.log(`Processing page ${processedPages}, found ${items.length} pull requests...`);

            const done = await processPage(items);

            console.log(`Done procesing page ${processedPages}.`);

            if (done) {
                break;
            }
        }
    }

    async function processPage(items: PullRequest[]) {
        for (const item of items) {
            processedItems++;
            if (processedItems >= maxProcessedItems) {
                console.log();
                console.log(`== Reached maximum. Already processed: ${processedItems}. Max is: ${maxProcessedItems}.`);
                return true;
            }

            if (closedItemCount >= maxClosedItems) {
                console.log();
                console.log(`== Reached maximum. Already closed: ${closedItemCount}. Max is: ${maxClosedItems}.`);
                return true;
            }

            if (settings.debug) {
                console.log();
                console.log(`== ${processedItems}. Processing pull requests #${item.number}...`);
            }

            const pr = await github.pullRequests.get({ ...repo, number: item.number });
            if (pr.mergeable === true) {
                if (settings.debug) {
                    console.log(`==== Pull Request is mergable, skipping.`);
                }
                continue;
            }

            if (item.updated_at && new Date(item.updated_at) > cutoffDate) {
                if (settings.debug) {
                    console.log(`==== Pull Request last updated on ${new Date(item.updated_at)}, skipping.`);
                }
                continue;
            }

            if (settings.pr.closeMessage) {
                console.log(`==== Adding comment...`);
                if (!settings.dry) {
                    // Add it
                    const comment: Response & Comment = await github.issues.createComment({ ...repo, number: item.number, body: settings.pr.closeMessage });
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

            console.log(`==== Closing pull request #${item.number}...`);
            if (!settings.dry) {
                // Close it
                const result: Response & PullRequest = await github.pullRequests.update({ ...repo, number: item.number, state: "closed", base: item.base.ref });

                // Record it
                itemsClosed.push(result);
                // Log it
                if (settings.debug) {
                    console.log("--- Pull Requests Closed: ");
                    console.log(stringify(result));
                }
                // Verify it
                if (!result || !result.meta || result.meta.status !== "200 OK") {
                    console.log(`==== Closing failed: ${stringify(result)}.`);
                    continue;
                }
            }
            closedItemCount++;

            if (settings.debug) {
                console.log(`== Done!`);
            }

        }
        return false;
    }
}

closePRs();

