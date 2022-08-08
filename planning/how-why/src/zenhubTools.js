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
 *   releases: { nodes: {
 *     id: string,
 *     endOn: string,
 *     title: string,
 *     issues: { nodes: IssueKey[] }
 *   }[]}
 *   repositoriesConnection: { nodes: {
 *     ghId: number,
 *     ownerName: string,
 *     name: string,
 *   }[]}
 * }} WorkspaceInfo
 *
 * @typedef {{
 *   repository: {
 *     ownerName: string,
 *     name: string,
 *     ghId: number,
 *   },
 *   number: number,
 * }} IssueKey
 * @typedef {IssueKey & {title: string, state: 'OPEN' | 'CLOSED'}} IssueLeaf
 *
 * @typedef {IssueLeaf & {
 *  blockedIssues: { nodes: IssueLeaf[] },
 *  blockingIssues: { nodes: IssueLeaf[] },
 *  body: string,
 *  labels: { nodes: { name: string, color: string}[] },
 * }} IssueInfo
 */

/**
 * authoring tool: https://developers.zenhub.com/explorer
 */
const queries = {
  workspace: `
query workspaceReleases($id: ID!) {
  workspace(id: $id) {
    name
    defaultRepository {
      ghId
      ownerName
      name
    }
    releases(state: {eq: OPEN}) {
      nodes {
        id
        state
        endOn
        title
        issues {
          totalCount
          nodes {
            repository { ghId ownerName name }
            number
          }
        }
      }
    }
    repositoriesConnection {
      nodes {
        ownerName
        name
        ghId
      }
    }
  }
}`,
  issue: `
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
        state
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
        state
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
}`,
};

/**
 * @param {string} id
 * @param {ReturnType<typeof import('./graphql').endpoint>} endpoint
 */
export const queryWorkspace = async (id, endpoint) => {
  const result = await endpoint.query(queries.workspace, { id });
  if (!("data" in result)) {
    throw Error("queryWorkspace: no data");
  }
  return result.data.workspace;
};

/** @param {Map<string, IssueInfo>} issueDetail */
export const issueDepDot = (issueDetail) => {
  /** @param {IssueLeaf} k */
  const node = ({ number, state, title }) =>
    ` issue${number} [label="#${number}", style=filled, fillcolor=${
      state === "CLOSED" ? "green" : "red"
    }, tooltip=${JSON.stringify(title)}]`;

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

/**
 * @param {string} workspaceId
 * @param {IssueKey[]} issueKeys
 * @param {ReturnType<typeof import('./graphql').endpoint>} endpoint
 */
export const deepDependencies = async (workspaceId, issueKeys, endpoint) => {
  const done = [];
  /** @type {Set<IssueKey>} */
  const todo = new Set(issueKeys);
  /** @type {Map<string, IssueInfo>} */
  const updated = new Map();

  for await (const current of todo) {
    console.debug("transitive deps:", { current, done });
    if (done.includes(issueUrl(current))) continue;
    await endpoint
      .query(queries.issue, {
        workspaceId,
        repositoryGhId: current.repository.ghId,
        issueNumber: current.number,
      })
      .then((result) => {
        console.log("issue query result:", result);
        if ("data" in result) {
          /** @type {{data: {issueByInfo: IssueInfo}}} */
          const {
            data: { issueByInfo },
          } = result;
          done.push(issueUrl(issueByInfo));
          updated.set(issueUrl(issueByInfo), issueByInfo);
          // issueByInfo.blockedIssues.nodes.forEach((i) => todo.add(i));
          issueByInfo.blockingIssues.nodes.forEach((i) => todo.add(i));
        } else {
          console.warn("TODO: handle query failures?", result);
        }
      });
  }
  return updated;
};
