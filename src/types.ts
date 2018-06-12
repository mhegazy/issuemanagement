declare module "*.json" {
    const _value: string;
    export = _value;
}

interface User {
    "login": string;
    "id": number;
    "avatar_url": string;
    "gravatar_id": string;
    "url": string;
    "html_url": string;
    "followers_url": string;
    "following_url": string;
    "gists_url": string;
    "starred_url": string;
    "subscriptions_url": string;
    "organizations_url": string;
    "repos_url": string;
    "events_url": string;
    "received_events_url": string;
    "type": string;
    "site_admin": boolean;
}

interface Label {
    "id": number;
    "url": string
    "name": string;
    "color": string;
    "default": boolean
}

interface Issue {
    "url": string;
    "repository_url": string;
    "labels_url": string;
    "comments_url": string;
    "events_url": string;
    "html_url": string;
    "id": number;
    "number": number;
    "title": string;
    "user": User;
    "labels": Label[];
    "state": "open" | "closed"
    "locked": boolean;
    "assignee": User | null;
    "assignees": User[];
    "milestone": Milestone;
    "comments": number;
    "created_at": string | null;
    "updated_at": string | null;
    "closed_at": string | null;
    "body": string | null;
    "pull_request"?: {
        "url": string;
        "html_url": string;
        "diff_url": string;
        "patch_url": string;
    };
    "closed_by"?: User;
}

interface Milestone {
    "url": string;
    "html_url": string;
    "labels_url": string;
    "id": number;
    "number": number;
    "state": "open" | "closed";
    "title": string;
    "description": string;
    "creator": User;
    "open_issues": number;
    "closed_issues": number;
    "created_at": string;
    "updated_at": string;
    "closed_at": string | null;
    "due_on": string;
}

interface Response {
    "meta": {
        "x-ratelimit-limit": string;
        "x-ratelimit-remaining": string;
        "x-ratelimit-reset": string;
        "x-oauth-scopes": string;
        "x-github-request-id": string;
        "location": string;
        "etag": string;
        "status": string;
        "link": string;
        "rel": string;
    }
}

interface Comment {
    "url": string;
    "html_url": string;
    "issue_url": string;
    "id": number;
    "user": User;
    "created_at": string;
    "updated_at": string;
    "body": string;
    "reactions"?: ReactionSummary;
}

interface ReactionSummary {
    "total_count": number;
    "+1": number;
    "-1": number;
    "laugh": number;
    "confused": number;
    "heart": number;
    "hooray": number;
    "url": string;
}

interface Reaction {
    "id": number;
    "user": User;
    "content": "+1" | "-1" | "laugh" | "confused" | "heart" | "hooray";
    "created_at": string;
}

type Events =
    | "closed" /**The issue was closed by the actor. When the commit_id is present, it identifies the commit that closed the issue using "closes / fixes #NN" syntax. */
    | "reopened" /**The issue was reopened by the actor. */
    | "subscribed" /** The actor subscribed to receive notifications for an issue.*/
    | "merged" /** The issue was merged by the actor. The `commit_id` attribute is the SHA1 of the HEAD commit that was merged. */
    | "referenced" /** The issue was referenced from a commit message. The `commit_id` attribute is the commit SHA1 of where that happened. */
    | "mentioned" /** The actor was @mentioned in an issue body. */
    | "assigned" /** The issue was assigned to the actor. */
    | "unassigned" /** The actor was unassigned from the issue. */
    | "labeled" /** A label was added to the issue. */
    | "unlabeled" /** A label was removed from the issue. */
    | "milestoned" /** The issue was added to a milestone. */
    | "demilestoned" /** The issue was removed from a milestone. */
    | "renamed" /** The issue title was changed. */
    | "locked" /** The issue was locked by the actor. */
    | "unlocked" /** The issue was unlocked by the actor. */
    | "head_ref_deleted" /** The pull request's branch was deleted. */
    | "head_ref_restored" /** The pull request's branch was restored. */
    | "review_dismissed" /** The actor dismissed a review from the pull request. */
    | "review_requested" /** The actor requested review from the subject on this pull request. */
    | "review_request_removed" /** The actor removed the review request for the subject on this pull request. */
    ;

interface Event {
    "id": number;
    "url": string;
    "actor": User;
    "event": Events;
    "commit_id"?: string;
    "commit_url"?: string;
    "label"?: Label;
    "assignee"?: User;
    "assigner"?: User;
    "review_requester"?: User;
    "requested_reviewer"?: User;
    "dismissed_review"?: Review;
    "milestone"?: Milestone;
    "rename"?: { "from": string, "to": string };
}

interface Review {
    "id": number;
    "user": User;
    "body": string;
    "commit_id": string;
    "state": string;
    "html_url": string;
    "pull_request_url": string;
    "_links": Links;
}

interface Links {
    "self"?: Link;
    "html"?: Link;
    "issue"?: Link;
    "comments"?: Link;
    "review_comments"?: Link;
    "review_comment"?: Link;
    "commits"?: Link;
    "statuses"?: Link;
}

interface Link {
    href: string;
}

interface Branch {
    "label": string,
    "ref": string,
    "sha": string,
    "user": User;
    "repo": Repo;
}

interface PullRequest {
    "url": string;
    "repository_url": string;
    "labels_url": string;
    "comments_url": string;
    "events_url": string;
    "html_url": string;
    "id": number;
    "number": number;
    "title": string;
    "user": User;
    "labels": Label[];
    "state": "open" | "closed"
    "locked": boolean;
    "assignee": User | null;
    "assignees": User[];
    "milestone": Milestone;
    "comments": number;
    "created_at": string | null;
    "updated_at": string | null;
    "closed_at": string | null;
    "merged_at": string | null;
    "body": string | null;
    "closed_by"?: User;
    "head": Branch;
    "base": Branch;
    "mergeable": boolean | null;
}

interface Repo {
    "id": number,
    "node_id": string,
    "owner": User,
    "name": string,
    "full_name": string,
    "description": string,
    "private": boolean,
    "fork": boolean,
    "url": string,
    "language": string | null,
    "forks_count": number,
    "stargazers_count": number,
    "watchers_count": number,
    "size": number,
    "default_branch": string,
    "open_issues_count": number,
    "topics": string[];
    "has_issues": boolean,
    "has_wiki": boolean,
    "has_pages": boolean,
    "has_downloads": boolean,
    "archived": boolean,
    "pushed_at": string,
    "created_at": string,
    "updated_at": string,
    "permissions": {
        "admin": boolean,
        "push": boolean,
        "pull": boolean
    },
    "allow_rebase_merge": boolean,
    "allow_squash_merge": boolean,
    "allow_merge_commit": boolean,
    "subscribers_count": number;
    "network_count": number;
}