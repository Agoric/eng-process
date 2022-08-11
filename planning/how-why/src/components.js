// @ts-check
import { h, render } from "preact";
import htm from "htm";

import { issueUrl } from "./zenhubTools";

/** @typedef {import('./zenhubTools').WorkspaceInfo} WorkspaceInfo */
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
        <button type="button" onClick=${onSubmit}>Save</button> <br />
        <small>
          <!-- anybody know how to get vs-code to stop eating significant whitespace? -->
          <span>See </span>
          <a
            href="https://developers.zenhub.com/graphql-api-docs/getting-started"
            >Getting Started</a
          >
          <span> if you need one.</span></small
        >
      </fieldset>
    </form>`;
  };

const repositorySelection = (repositories, issueKey) => {
  if (!repositories.length) {
    return html`<em>no repository info yet...</em>`;
  }

  console.warn("TODO: make repo selectable");
  return html`<select disabled>
    ${repositories.map(
      (r) =>
        html`<option
          ...${r.ghId === issueKey.repository.ghId ? { selected: true } : {}}
          value=${r.ghId}
        >
          ${r.ownerName}/${r.name}
        </option>`
    )}
  </select>`;
};

const releaseSelection = (releases, releaseId, setReleaseId) => {
  if (!releases.length) {
    return html`<em>no release info yet...</em>`;
  }

  return html`<select onChange=${(ev) => setReleaseId(ev.target.value)}>
    ${releases.map(
      (r) => html`<option
        ...${r.id === releaseId ? { selected: true } : {}}
        value=${r.id}
      >
        ${r.endOn}: ${r.title}
      </option>`
    )}
  </select>`;
};

/**
 * @param {Object} state
 * @param {IssueKey | null} state.issueKey
 * @param {(v: IssueKey) => void} state.setIssueKey
 * @param {Map<string, IssueInfo>} state.issueDetail
 * @param {WorkspaceInfo | null} state.workspace
 * @param {string|null} state.releaseId
 * @param {(id: string) => void} state.setReleaseId
 */
export const Issue =
  ({
    issueKey,
    setIssueKey,
    issueDetail,
    workspace,
    releaseId,
    setReleaseId,
  }) =>
  () => {
    if (!(issueKey && workspace)) return html``;

    const issueByInfo = issueDetail.get(issueUrl(issueKey));

    const onSubmit = (ev) => {
      const issueNumber = parseInt(ev.target.querySelector("input").value, 10);
      setIssueKey({ ...issueKey, number: issueNumber });
      ev.preventDefault();
    };

    const repoControl = repositorySelection(
      workspace.repositoriesConnection.nodes,
      issueKey
    );

    const numControl = html`<label
      >#<input size="5" type="number" value="${issueKey.number}"
    /></label>`;

    const form = (detail) => html`<h2>Issue Dependencies</h2>
      <form onSubmit=${onSubmit}>
        <fieldset>
          ${releaseSelection(
            workspace.releases.nodes,
            releaseId,
            setReleaseId
          )}<br />
          ${repoControl} ${numControl}${" "} ${detail}
        </fieldset>
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
