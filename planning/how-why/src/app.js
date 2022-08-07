// @ts-check
import { h, render } from "preact";
import { useState, useEffect } from "preact/hooks";
import htm from "htm";

import { endpoint as graphql } from "./graphql";

// Initialize htm with Preact
const html = htm.bind(h);

const key = "zenhub.apikey";

const APIKey = (apiKey, setKey) => () => {
  const onInput = (ev) => {
    const { value } = ev.target;
    // console.log("onInput", { value });
    setKey(value);
  };

  const onSubmit = (ev) => {
    // console.log("onSubmit", { apiKey });
    localStorage.setItem(key, apiKey);
  };

  return html`<form>
    <fieldset>
      <label>
        ZenHub API Key:
        <input type="password" value=${apiKey} onInput=${onInput} />
      </label>
      <button type="button" onClick=${onSubmit}>Save</button>
    </fieldset>
  </form>`;
};

const Agoric = {
  repositories: {
    ["agoric-sdk"]: 219012610,
  },
  workspaceId: "Z2lkOi8vcmFwdG9yL1plbmh1YlVzZXIvNjM0NDE4",
};

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
const issueQuery = `
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

const reposQuery = `
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

const Error = (error) => html`<p><strong>${error.message}</strong></p> `;

/** @param {Map<string, IssueInfo>} issueDetail */
const issueDepDot = (issueDetail) => {
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

/** @param {{ ownerName: string, name: string }} k */
const repoUrl = ({ ownerName, name }) =>
  `https://github.com/${ownerName}/${name}`;

/** @param {{ repository: { ownerName: string, name: string }, number: number }} k */
const issueUrl = ({ repository: { ownerName, name }, number }) =>
  `https://github.com/${ownerName}/${name}/issues/${number}`;

const repositorySelection = (repositories, issueKey) => {
  if (!repositories.data) {
    return html``;
  }

  const {
    data: {
      viewer: {
        searchWorkspaces: {
          nodes: [
            {
              repositoriesConnection: { nodes },
            },
          ],
        },
      },
    },
  } = repositories;

  console.warn("TODO: make repo selectable");
  return html`<select disabled>
    ${nodes.map(
      (r) =>
        html`<option
          ...${r.ghId === issueKey.repositoryGhId ? { selected: true } : {}}
          value=${r.ghId}
        >
          ${r.ownerName}/${r.name}
        </option>`
    )}
  </select>`;
};

/**
 * @param {IssueKey} issueKey
 * @param {(v: IssueKey) => void} setIssueKey
 * @param {Map<string, IssueInfo>} issueDetail
 * @param {unknown} repositories
 */
const Issue = (issueKey, setIssueKey, issueDetail, repositories) => () => {
  const issueByInfo = issueDetail.get(issueUrl(issueKey));

  const onSubmit = (ev) => {
    const issueNumber = parseInt(ev.target.querySelector("input").value, 10);
    setIssueKey({ ...issueKey, number: issueNumber });
    ev.preventDefault();
  };

  const repoControl = repositorySelection(repositories, issueKey);

  const numControl = html`<label
    >#<input size="5" type="number" value="${issueKey.number}"
  /></label>`;

  const form = (detail) => html`<h2>Issue Dependencies</h2>
    <form onSubmit=${onSubmit}>
      <fieldset>${repoControl} ${numControl}${" "} ${detail}</fieldset>
    </form>`;

  if (!issueByInfo) {
    return form(html`<a href="${issueUrl(issueKey)}">#${issueKey.number}</a>`);
  }

  const {
    number,
    state,
    title,
    labels: { nodes: labels },
  } = issueByInfo;

  //  <small>${body}</small>
  return form(html`
    <a href="${issueUrl(issueKey)}">#${number} ${title}</a>: ${state}
    <p>
      Labels:
      ${labels.map(({ name, color }) => html`<b class="label">${name}</b> `)}
    </p>
  `);
};

const ZenHub = {
  // https://developers.zenhub.com/graphql-api-docs/getting-started#endpoint
  endpoint: "https://api.zenhub.com/public/graphql",
};

const App =
  ({ localStorage, fetch }) =>
  () => {
    if (window.location.hash) {
      console.warn("TODO: support apiKey in URL hash");
    }
    const [apiKey, setKey] = useState(localStorage.getItem(key));
    const [reason, setReason] = useState(null);
    const [repositories, setRepositories] = useState({});

    /** @template T @typedef {[T, import("preact/hooks").StateUpdater<T>]} StateT<T> */
    /** @type {StateT<IssueKey>} */
    const [issueKey, setIssueKey] = useState({
      repository: {
        ghId: Agoric.repositories["agoric-sdk"],
        ownerName: "Agoric",
        name: "agoric-sdk",
      },
      number: 1,
    });
    /** @type {StateT<Map<string, IssueInfo>>} */
    const [issueDetail, setIssueDetail] = useState(new Map());

    useEffect(() => {
      const endpoint = graphql(ZenHub.endpoint, apiKey, { fetch });

      const runQuery = async () => {
        setRepositories({});
        setReason(null);

        endpoint
          .query(reposQuery)
          .then((result) => {
            console.log("query result:", result);
            setRepositories(result);
          })
          .catch((r) => {
            setReason(r);
          });
      };
      runQuery();
    }, [apiKey]);

    useEffect(() => {
      const endpoint = graphql(ZenHub.endpoint, apiKey, { fetch });

      const runQuery = async () => {
        setReason(null);

        const done = [];
        /** @type {Set<IssueKey>} */
        const todo = new Set([issueKey]);
        /** @type {typeof issueDetail} */
        const updated = new Map();

        for await (const current of todo) {
          console.debug("transitive deps:", { current, done });
          if (done.includes(issueUrl(current))) continue;
          await endpoint
            .query(issueQuery, {
              workspaceId: Agoric.workspaceId,
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
            })
            .catch((r) => {
              setReason(r);
              throw r;
            });
        }
        setIssueDetail(updated);
        const dot = issueDepDot(updated);
        console.log(dot);
        globalThis.renderDot(dot);
      };
      runQuery();
    }, [apiKey, issueKey]);

    console.log("App state", { reason, issueKey, issueDetail, repositories });
    return html`
      <div>
        <${APIKey(apiKey, setKey)} />
        ${reason
          ? html`<${Error(reason)}`
          : html`<div>
              <${Issue(issueKey, setIssueKey, issueDetail, repositories)} />
            </div> `}
      </div>
    `;
  };

const container = document.querySelector("#ui");
if (!container) throw Error("missing #ui");
render(html`<${App({ localStorage, fetch })} />`, container);
