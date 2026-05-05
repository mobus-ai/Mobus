import assert from "node:assert/strict";
import { test } from "node:test";
import { redirectRootToMainSite } from "./routes.js";

test("root handler redirects to the main Mobus website", () => {
  let statusCode: number | undefined;
  let redirectUrl: string | undefined;

  redirectRootToMainSite({} as never, {
    redirect(status: number, url: string) {
      statusCode = status;
      redirectUrl = url;
    },
  } as never);

  assert.equal(statusCode, 302);
  assert.equal(redirectUrl, "https://mobus.ai");
});
