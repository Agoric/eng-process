// @ts-check

export const ZenHub = {
  // https://developers.zenhub.com/graphql-api-docs/getting-started#endpoint
  endpoint: "https://api.zenhub.com/public/graphql",
};

/** @param {{ ownerName: string, name: string }} k */
export const repoUrl = ({ ownerName, name }) =>
  `https://github.com/${ownerName}/${name}`;

/** @param {{ repository: { ownerName: string, name: string }, number: number }} k */
export const issueUrl = ({ repository: { ownerName, name }, number }) =>
  `https://github.com/${ownerName}/${name}/issues/${number}`;

/**
 * @typedef {{
 *   repository: {
 *     ownerName: string,
 *     name: string,
 *     ghId: number,
 *   },
 *   number: number,
 * }} IssueKey
 * @typedef {IssueKey & {title: string}} IssueLeaf
 *
 * @typedef {{
 *  state: 'OPEN' | 'CLOSED',
 *  number: number,
 *  title: string,
 *  repository: { ghId: number, ownerName: string, name: string },
 *  blockedIssues: { nodes: IssueLeaf[] },
 *  blockingIssues: { nodes: IssueLeaf[] },
 *  body: string,
 *  labels: { nodes: { name: string, color: string}[] },
 * }} IssueInfo
 */
export const issueQuery = `
query getIssueInfo($repositoryGhId: Int!, $issueNumber: Int!) {
  issueByInfo(repositoryGhId: $repositoryGhId, issueNumber: $issueNumber) {
    state
    number
    title
    repository {
      ghId
      ownerName
      name
    }
    blockedIssues {
      nodes {
        number
        title
        repository {
          ghId
          ownerName
          name
        }
      }
    }
    blockingIssues {
      nodes {
        number
        title
        repository {
          ghId
          ownerName
          name
        }
      }
    }
    body
    labels(first: 10) {
      nodes {
        name
        color
      }
    }
  }
}`;

export const reposQuery = `
{
  viewer {
    searchWorkspaces(query: "Agoric Primary Workspace") {
      nodes {
        name
        repositoriesConnection {
          nodes {
            ownerName
            name
            ghId
          }
        }
      }
    }
  }
}
`;

/** @param {Map<string, IssueInfo>} issueDetail */
export const issueDepDot = (issueDetail) => {
  /** @param {IssueLeaf} k */
  const node = ({ number, title }) =>
    ` issue${number} [label="#${number}", tooltip=${JSON.stringify(title)}]`;

  /** @type {(e: {tail: number, head: number}) => string} */
  const edge = ({ tail, head }) => `  issue${tail} -> issue${head}`;

  /** @param {IssueInfo} issueByInfo */
  const lines = (issueByInfo) => {
    const {
      repository: { ownerName, name },
      number,
      blockedIssues: { nodes: blockedIssues },
      blockingIssues: { nodes: blockingIssues },
    } = issueByInfo;

    const issues = [issueByInfo, ...blockedIssues, ...blockingIssues];
    const deps = [
      ...blockedIssues.map((hd) => ({ tail: number, head: hd.number })),
      ...blockingIssues.map((tl) => ({ tail: tl.number, head: number })),
    ];
    return [...issues.map(node), ...deps.map(edge)];
  };
  const dedup = (xs) => [...new Set(xs)];
  return `
  digraph {
    ${dedup([...issueDetail.values()].flatMap(lines)).join("\n")}
  }`;
};
