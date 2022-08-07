// @ts-check
import { h, render } from "preact";
import htm from "htm";

import { issueUrl } from "./zenhubTools";

/** @typedef {import('./zenhubTools').IssueKey} IssueKey */
/** @typedef {import('./zenhubTools').IssueInfo} IssueInfo */
/** @typedef {import('./zenhubTools').IssueLeaf} IssueLeaf */

// Initialize htm with Preact
export const html = htm.bind(h);

export const Error = (error) => html`<p><strong>${error.message}</strong></p> `;

export const APIKey =
  (apiKey, setKey, { storeItem }) =>
  () => {
    const onInput = (ev) => {
      const { value } = ev.target;
      // console.log("onInput", { value });
      setKey(value);
    };

    const onSubmit = (ev) => {
      // console.log("onSubmit", { apiKey });
      storeItem(apiKey);
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
export const Issue =
  (issueKey, setIssueKey, issueDetail, repositories) => () => {
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
      return form(
        html`<a href="${issueUrl(issueKey)}">#${issueKey.number}</a>`
      );
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
