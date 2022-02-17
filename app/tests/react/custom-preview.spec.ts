import { testSuite } from "../../testing";

const originalSource = `
import React from "react";

export function Button(props: { label: string; disabled?: boolean }) {
  return (
    <button id="button" disabled={props.disabled}>
      {props.label}
    </button>
  );
}
`;

export const customPreviewTests = testSuite("react/custom preview", (test) => {
  test(
    "shows variants when already configured",
    "react",
    async ({ appDir, controller }) => {
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: `import { setupPreviews } from '@previewjs/plugin-react/setup';
${originalSource}

setupPreviews(Button, {
  default: {
    label: "default variant",
  },
  disabled: {
    label: "disabled variant",
    disabled: true,
  },
});
`,
      });
      await controller.show("src/Button.tsx:Button");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'default variant')]"
      );
    }
  );

  test(
    "shows variants once preview added and hides once removed",
    "react",
    async ({ appDir, controller }) => {
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: originalSource,
      });
      await controller.show("src/Button.tsx:Button");
      const previewIframe = await controller.previewIframe();
      await controller.props.editor.isReady();
      await previewIframe.waitForSelector("#button");

      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: `import { setupPreviews } from '@previewjs/plugin-react/setup';
${originalSource}

setupPreviews(Button, {
  default: {
    label: "default variant",
  },
  disabled: {
    label: "disabled variant",
    disabled: true,
  },
});
`,
      });
      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'default variant')]"
      );

      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: originalSource,
      });
      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'default variant')]",
        {
          state: "hidden",
        }
      );
      await previewIframe.waitForSelector("#button");
    }
  );

  test(
    "supports variants defined as function",
    "react",
    async ({ appDir, controller }) => {
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: originalSource,
      });
      await controller.show("src/Button.tsx:Button");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector("#button");
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: `import { setupPreviews } from '@previewjs/plugin-react/setup';
${originalSource}

setupPreviews(Button, () => ({
  default: {
    label: "custom label",
  },
}));
`,
      });
      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'custom label')]"
      );
    }
  );

  test(
    "updates when preview is updated",
    "react",
    async ({ appDir, controller }) => {
      console.log("1");
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: originalSource,
      });
      console.log("2");
      await controller.show("src/Button.tsx:Button");
      console.log("3");
      const previewIframe = await controller.previewIframe();
      console.log("4");
      await previewIframe.waitForSelector("#button");
      console.log("5");
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: `import { setupPreviews } from '@previewjs/plugin-react/setup';
${originalSource}

setupPreviews(Button, {
  default: {
    label: "default",
  },
  disabled: {
    label: "disabled",
    disabled: true,
  },
});
`,
      });
      console.log("6");

      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'default')]"
      );
      console.log("7");

      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: `import { setupPreviews } from '@previewjs/plugin-react/setup';
${originalSource}

setupPreviews(Button, {
  default: {
    label: "foo label",
  },
  bar: {
    label: "bar label",
    disabled: true,
  },
});
`,
      });
      console.log("8");
      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'foo label')]"
      );
      console.log("9");
    }
  );

  test(
    "hides props editor for configured variants",
    "react",
    async ({ appDir, controller }) => {
      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: originalSource,
      });
      await controller.show("src/Button.tsx:Button");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector("#button");
      await controller.props.editor.isReady();

      await appDir.update("src/Button.tsx", {
        kind: "replace",
        text: `import { setupPreviews } from '@previewjs/plugin-react/setup';
${originalSource}

setupPreviews(Button, {
  default: {
    label: "default",
  },
});
`,
      });

      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'default')]"
      );
      await controller.props.editor.waitUntilGone();

      await controller.component.label().click();
      await controller.props.editor.isReady();

      await controller.props.editor.replaceText(`properties = {
        label: "foo"
      }`);
      await previewIframe.waitForSelector("xpath=//button[contains(., 'foo')]");
    }
  );
});
