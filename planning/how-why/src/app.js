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
      <p><em>TODO: support apiKey in URL hash</em></p>
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

const Issue = (key, setKey, result) => () => {
  console.log("Issue", { key, result });

  const onInput = (ev) => {
    const issueNumber = parseInt(ev.target.value, 10);
    setKey({ ...key, issueNumber });
  };
  const numControl = html`<label
      >Number:
      <input type="number" value="${key.issueNumber}" onBlur=${onInput}
    /></label>
    <em>TODO: show repo</em>`;

  const detail = () => {
    if (!result.data) {
      return html``;
    }

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
    } = result;
    const url = `https://github.com/${ownerName}/${name}/issues/${number}`;
    return html`<h3><a href="${url}">#${number}</a> ${title}: ${state}</h3>
      <p>
        ${labels.map(({ name, color }) => html`<b class="label">${name}</b> `)}
      </p>
      <p>
        <b>blocking: </b>
        ${blockedIssues.map(
          ({ number, title }) => html`<a title=${title}>#${number}</a> `
        )}
      </p>
      <p>
        <b>blocked by: </b>
        ${blockingIssues.map(
          ({ number, title }) => html`<a title=${title}>#${number}</a> `
        )}
      </p>
      <small>${body}</small> `;
  };

  return html`<h2>Issue: TODO</h2>
    ${numControl}
    <br />
    ${detail()}`;
};

const Repositories = (result) => () => {
  if (!result.data) {
    return html``;
  }
  // console.log("Repositores", { result });
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
  } = result;

  const repoUrl = ({ ownerName, name }) =>
    `https://github.com/${ownerName}/${name}`;

  return html` <h2>Repositories</h2>
    <ul>
      ${nodes.map(
        (r) =>
          html`<li title=${r.ghId}><a href="${repoUrl(r)}">${r.name}</a></li>`
      )}
    </ul>`;
};

const ZenHub = {
  // https://developers.zenhub.com/graphql-api-docs/getting-started#endpoint
  endpoint: "https://api.zenhub.com/public/graphql",
};

const App =
  ({ localStorage, fetch }) =>
  () => {
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
          })
          .catch((r) => {
            setReason(r);
          });
      };
      runQuery();
    }, [apiKey, issueKey]);

    console.log("App state", { reason, issueKey });
    return html`
      <div>
        ${reason
          ? html`<${Error(reason)}`
          : html`<div>
              <${Issue(issueKey, setIssueKey, issueDetail)} />
              <${Repositories(repositories)} />
            </div> `}
        <${APIKey(apiKey, setKey)} />
      </div>
    `;
  };

const container = document.querySelector("#ui");
if (!container) throw Error("missing #ui");
render(html`<${App({ localStorage, fetch })} />`, container);
