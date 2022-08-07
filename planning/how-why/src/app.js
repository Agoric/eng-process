// @ts-check
import { h, Component, render } from "preact";
import { useState, useEffect } from "preact/hooks";
import htm from "htm";

// Initialize htm with Preact
const html = htm.bind(h);

const key = "zenhub.apikey";

const APIKey =
  ({ localStorage }) =>
  () => {
    const [apiKey, setKey] = useState(localStorage.getItem(key));

    const onInput = (ev) => {
      const { value } = ev.target;
      console.log("onInput", { value });
      setKey(value);
    };
    const onSubmit = (ev) => {
      console.log("onSubmit", { apiKey });
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

render(html`<${APIKey({ localStorage })} />`, document.body);
