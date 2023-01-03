import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

const testApp = path.join(__dirname, "apps", "vue2");

test.describe.parallel("vue2/jsx", () => {
  const test = previewTest([pluginFactory], testApp);

  test("renders JSX component", async (preview) => {
    await preview.fileManager.update(
      "src/Button.jsx",
      `export const Button = ({props}) => {
        return <button>
        {props.label || "a button"}
        </button>
      }`
    );
    await preview.show("src/Button.jsx:Button");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'a button')]"
    );
  });
});
