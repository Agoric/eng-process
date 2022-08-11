// @ts-check
/** @typedef {import('./zenhubTools').IssueInfo} IssueInfo */
/** @typedef {import('./zenhubTools').IssueLeaf} IssueLeaf */

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
      // blockingIssues: { nodes: blockingIssues },
      epic,
    } = issueByInfo;

    const issues = [issueByInfo, ...blockedIssues];
    const deps = [
      ...blockedIssues.map((hd) => ({ tail: number, head: hd.number })),
      ...(epic?.childIssues?.nodes || []).map((tl) => ({
        tail: tl.number,
        head: number,
      })),
    ];
    return [...issues.map(node), ...deps.map(edge)];
  };
  const dedup = (xs) => [...new Set(xs)];
  return `
  digraph {
    ${dedup([...issueDetail.values()].flatMap(lines)).join("\n")}
  }`;
};
