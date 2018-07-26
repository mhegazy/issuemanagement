import fs from "fs";
import GitHubApi from "github";
import path from "path";
import settings from "./settings.json";
import token from "./token.json";

const repo = { owner: settings.owner, repo: settings.repo };
const cutoffDate = new Date((new Date()).getTime() - (settings.lock.dayesSinceLastEdit * 24 * 60 * 60 * 1000));
const maxProcessedIssues = settings.lock.maxProcessed > 0 ? settings.lock.maxProcessed : Infinity;
const maxLockedIssues = settings.lock.maxLocked > 0 ? settings.lock.maxLocked : Infinity;

function stringify(o: any) {
    return JSON.stringify(o, undefined, 2);
}

async function doWithRetry<T>(action: () => Promise<T>) {
    let result: T;
    for (let counter = 0; counter < 3; counter++) {
        try {
            return await action();
            break;
        }
        catch (e) {
            console.log();
            console.log(`Found error: ${e}`);
            if (counter == 2) throw e;
            console.log(`Retrying (attempt ${counter + 1} out of 3) ...`);
        }
    }
}

async function lockIssues() {
    const issuesLocked: Issue[] = [];
    let issuesLockedCount = 0;

    let processedIssues = 0;

    // Create log location
    const baseLogFolder = path.join(__dirname, settings.logFolder);
    if (!fs.existsSync(baseLogFolder)) {
        fs.mkdirSync(baseLogFolder);
    }
    const baseLockLogFolder = path.join(baseLogFolder, "lock");
    if (!fs.existsSync(baseLockLogFolder)) {
        fs.mkdirSync(baseLockLogFolder);
    }
    const logFolder = path.join(baseLockLogFolder, `${new Date().getTime()}`)
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
            fs.writeFileSync(path.join(logFolder, "issuesLocked.json"), stringify(issuesLocked));
        }

        console.log();
        console.log(`Processed Issues: ${processedIssues}`);
        console.log(`Issues Locked: ${issuesLockedCount}`);
    }

    async function processPages() {
        let issues: Issue[] & Response | undefined;
        let processedPages = 0;

        while (true) {
            processedPages++;

            if (!issues) {
                issues = await doWithRetry(() => github.issues.getForRepo({ ...repo, state: "closed", sort: "created", direction: "asc", page: settings.lock.firstPage > 0 ? settings.lock.firstPage : undefined }));
            }
            else if (github.hasNextPage(issues)) {
                for (let counter = 0; counter < 3; counter++) {
                    try {
                        issues = await doWithRetry(() => github.getNextPage(issues!));
                        break;
                    }
                    catch (e) {
                        console.log(`Found error: ${e}`);
                        console.log(`Retrying (attempt ${counter + 1} out of 3) ...`);
                    }
                }
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
                console.log("Found no more closed issues!");
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

            if (issuesLockedCount >= maxLockedIssues) {
                console.log();
                console.log(`== Reached maximum. Already locked: ${issuesLockedCount}. Max is: ${maxLockedIssues}.`);
                return true;
            }

            if (settings.debug) {
                console.log();
                console.log(`== ${processedIssues}. Processing issue #${issue.number}...`);
            }

            if (+issue.number <= settings.lock.firstIssue) {
                console.log(`== Before first issue, skipping.`);
                continue;
            }

            if (issue.updated_at && new Date(issue.updated_at) > cutoffDate) {
                if (settings.debug) {
                    console.log(`==== Issue last updated on ${new Date(issue.updated_at)}, skipping.`);
                }
                continue;
            }

            if (issue.locked) {
             //   if (settings.debug) {
                    console.log(`==== Issue already locked, skipping.`);
             //   }
                continue;
            }
            console.log(`==== Locking issue #${issue.number}...`);
            if (!settings.dry) {
                // Close it
                const result: Response & Issue = await github.issues.lock({ ...repo, number: issue.number});
                // Record it
                issuesLocked.push(result);
                // Log it
                if (settings.debug) {
                    console.log("--- Issue Locked: ");
                    console.log(stringify(result));
                }
                // Verify it
                if (!result || !result.meta || result.meta.status !== "204 No Content") {
                    console.log(`==== Locking failed: ${stringify(result)}.`);
                    continue;
                }
            }
            issuesLockedCount++;

            if (settings.debug) {
                console.log(`== Done!`);
            }
        }
        return false;
    }
}

lockIssues();

