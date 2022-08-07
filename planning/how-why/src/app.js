// @ts-check
import { h, render } from "preact";
import { useState, useEffect } from "preact/hooks";
import htm from "htm";

import { endpoint as graphql } from "./graphql";
import {
  ZenHub,
  reposQuery,
  issueQuery,
  issueUrl,
  issueDepDot,
} from "./zenhubTools";
import { APIKey, Error, Issue } from "./components";

/** @template T @typedef {[T, import("preact/hooks").StateUpdater<T>]} StateT<T> */
/** @typedef {import('./zenhubTools').IssueKey} IssueKey */
/** @typedef {import('./zenhubTools').IssueInfo} IssueInfo */
/** @typedef {import('./zenhubTools').IssueLeaf} IssueLeaf */

// Initialize htm with Preact
export const html = htm.bind(h);

export const key = "zenhub.apikey";

const Agoric = {
  repositories: {
    ["agoric-sdk"]: 219012610,
  },
  workspaceId: "Z2lkOi8vcmFwdG9yL1plbmh1YlVzZXIvNjM0NDE4",
};

/**
 * @param {IssueKey} issueKey
 * @param {ReturnType<typeof graphql>} endpoint
 */
const deepDependencies = async (issueKey, endpoint) => {
  const done = [];
  /** @type {Set<IssueKey>} */
  const todo = new Set([issueKey]);
  /** @type {Map<string, IssueInfo>} */
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
      });
  }
  return updated;
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

        const updated = await deepDependencies(issueKey, endpoint).catch(
          (r) => {
            setReason(r);
            throw r;
          }
        );
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
        <${APIKey(apiKey, setKey, {
          storeItem: (value) => localStorage.set(key, value),
        })} />
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
