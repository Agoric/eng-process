// @ts-check
import { h, render } from "preact";
import { useState, useEffect } from "preact/hooks";
import htm from "htm";

import { endpoint as graphql } from "./graphql";
import {
  ZenHub,
  issueDepDot,
  deepDependencies,
  queryWorkspace,
} from "./zenhubTools";
import { APIKey, Error, Issue } from "./components";

/** @template T @typedef {[T, import("preact/hooks").StateUpdater<T>]} StateT<T> */
/** @typedef {import('./zenhubTools').WorkspaceInfo} WorkspaceInfo */
/** @typedef {import('./zenhubTools').IssueKey} IssueKey */
/** @typedef {import('./zenhubTools').IssueInfo} IssueInfo */
/** @typedef {import('./zenhubTools').IssueLeaf} IssueLeaf */

// Initialize htm with Preact
export const html = htm.bind(h);

export const key = "zenhub.apikey";

export const Agoric = {
  repositories: {
    ["agoric-sdk"]: 219012610,
  },
  workspaceId: "5fda3aa55dbe1100117cbaae", // XXX move to .html form value?
};

const App =
  ({ localStorage, fetch }) =>
  () => {
    if (window.location.hash) {
      console.warn("TODO: support apiKey in URL hash");
    }
    const [apiKey, setKey] = useState(
      /** @type {string | undefined} */ (localStorage.getItem(key))
    );
    const [reason, setReason] = useState(/** @type {Error | null} */ (null));
    const [workspace, setWorkspace] = useState(
      /** @type {WorkspaceInfo | null} */ (null)
    );
    const [releaseId, setReleaseId] = useState(
      /** @type {string | null} */ (null)
    );
    const [issueKey, setIssueKey] = useState(
      /** @type {IssueKey | null} */ (null)
    );
    /** @type {StateT<Map<string, IssueInfo>>} */
    const [issueDetail, setIssueDetail] = useState(new Map());

    const workspaceEffect = () => {
      if (!apiKey) return;
      const endpoint = graphql(ZenHub.endpoint, apiKey, { fetch });

      // NOTE: async inside an effect requires this peculiar pattern.
      const runQuery = async () => {
        setReason(null);

        const info = await queryWorkspace(Agoric.workspaceId, endpoint).catch(
          (r) => {
            setReason(r);
          }
        );
        console.log("workspace query result:", info);
        setWorkspace(info);
        const release = info?.releases?.nodes[0];
        if (release) {
          setReleaseId(release.id);
        } else {
          console.warn("cannot find first release");
        }
      };
      runQuery();
    };
    useEffect(workspaceEffect, [apiKey]);

    useEffect(() => {
      const releases = workspace?.releases?.nodes;
      if (!releases) {
        console.warn("cannot find first issue of first release");
        return;
      }
      const release = releases.find((r) => r.id === releaseId);
      if (!release) {
        console.warn(`cannot find release ${releaseId}`);
        return;
      }

      setIssueKey(release.issues.nodes[0]);
    }, [workspace, releaseId]);

    const issuesEffect = () => {
      if (!apiKey) return;
      const endpoint = graphql(ZenHub.endpoint, apiKey, { fetch });

      const runQuery = async () => {
        if (!issueKey) return;
        setReason(null);

        const updated = await deepDependencies(
          Agoric.workspaceId,
          issueKey,
          endpoint
        ).catch((r) => {
          setReason(r);
          throw r;
        });
        setIssueDetail(updated);
        const dot = issueDepDot(updated);
        console.log(dot);
        globalThis.renderDot(dot);
      };
      runQuery();
    };
    useEffect(issuesEffect, [apiKey, workspace, issueKey]);

    console.log("App state", {
      reason,
      issueKey,
      issueDetail,
      workspace,
      release: releaseId,
    });
    return html`
      <div>
        <${APIKey(apiKey, setKey, {
          storeItem: (value) => localStorage.set(key, value),
        })} />
        ${reason
          ? html`<${Error(reason)} />`
          : html`<${Issue({
              issueKey,
              setIssueKey,
              issueDetail,
              workspace,
              releaseId,
              setReleaseId,
            })} />`}
      </div>
    `;
  };

const container = document.querySelector("#ui");
if (!container) throw Error("missing #ui");
render(html`<${App({ localStorage, fetch })} />`, container);
