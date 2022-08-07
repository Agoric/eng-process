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
    const [repositories, setRepositories] = useState({});
    const [reason, setReason] = useState(null);

    useEffect(() => {
      const endpoint = graphql(ZenHub.endpoint, apiKey, { fetch });
      const runQuery = async () => {
        setRepositories({});
        setReason(null);

        endpoint
          .query(reposQuery)
          .then((data) => {
            console.log("query result:", data);
            setRepositories(data);
          })
          .catch((r) => {
            setReason(r);
          });
      };
      runQuery();
    }, [apiKey]);

    console.log({ reason });
    return html`
      <div>
        ${reason
          ? html`<${Error(reason)}`
          : html`<${Repositories(repositories)} />`}
        <${APIKey(apiKey, setKey)} />
      </div>
    `;
  };

const container = document.querySelector("#ui");
if (!container) throw Error("missing #ui");
render(html`<${App({ localStorage, fetch })} />`, container);
