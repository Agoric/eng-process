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
      }
    }
    blockingIssues {
      nodes {
        number
        title
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

const issueDepDot = (result) => {
  const {
    data: { issueByInfo },
  } = result;
  const {
    repository: { ownerName, name },
    number,
    state,
    title,
    labels: { nodes: labels },
    body,
    blockedIssues: { nodes: blockedIssues },
    blockingIssues: { nodes: blockingIssues },
  } = issueByInfo;

  const issues = [issueByInfo, ...blockedIssues, ...blockingIssues];
  const deps = [
    ...blockedIssues.map((hd) => [number, hd.number]),
    ...blockingIssues.map((tl) => [tl.number, number]),
  ];
  const node = ({ number, title }) =>
    ` issue${number} [label="#${number}", tooltip=${JSON.stringify(title)}]`;
  const edge = ([tl, hd]) => `  issue${tl} -> issue${hd}`;
  return `
  digraph {
    ${issues.map(node).join("\n")}
    ${deps.map(edge).join("\n")}
  }`;
};

const repoUrl = ({ ownerName, name }) =>
  `https://github.com/${ownerName}/${name}`;

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

const Issue = (issueKey, setIssueKey, issueDetail, repositories) => () => {
  if (!issueDetail.data) {
    return html`<em>no issueDetail available yet</em>`;
  }

  const onSubmit = (ev) => {
    const issueNumber = parseInt(ev.target.querySelector("input").value, 10);
    setIssueKey({ ...issueKey, issueNumber });
    ev.preventDefault();
  };

  const repoControl = repositorySelection(repositories, issueKey);

  const numControl = html`<label
    >#<input size="5" type="number" value="${issueKey.issueNumber}"
  /></label>`;

  const {
    data: {
      issueByInfo: {
        repository: { ownerName, name },
        number,
        state,
        title,
        labels: { nodes: labels },
        body,
        blockedIssues: { nodes: blockedIssues },
        blockingIssues: { nodes: blockingIssues },
      },
    },
  } = issueDetail;
  const url = `https://github.com/${ownerName}/${name}/issues/${number}`;

  return html`<h2>Issue Dependencies</h2>
    <form onSubmit=${onSubmit}>
      <fieldset>
        ${repoControl} ${numControl}${" "}
        <a href="${url}">#${number} ${title}</a>: ${state}
        <p>
          Labels:
          ${labels.map(
            ({ name, color }) => html`<b class="label">${name}</b> `
          )}
        </p>
      </fieldset>
    </form>`;
  //  <small>${body}</small>
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
    const [issueKey, setIssueKey] = useState({
      repositoryGhId: Agoric.repositories["agoric-sdk"],
      issueNumber: 1,
    });
    const [issueDetail, setIssueDetail] = useState({});

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

        endpoint
          .query(issueQuery, {
            workspaceId: Agoric.workspaceId,
            ...issueKey,
          })
          .then((result) => {
            console.log("issue query result:", result);
            setIssueDetail(result);
            const dot = issueDepDot(result);
            console.log(dot);
            globalThis.renderDot(dot);
          })
          .catch((r) => {
            setReason(r);
          });
      };
      runQuery();
    }, [apiKey, issueKey]);

    console.log("App state", { reason, issueKey, repositories });
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
