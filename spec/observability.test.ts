import { expect, it } from "vitest";
import { actionRoute } from "../src/observability.ts";

it("names user actions without logging secret-bearing or high-volume routes", () => {
  expect(actionRoute("POST", "/claims/claim-1/review")).toEqual({
    action: "review_submitted", targetId: "claim-1",
  });
  expect(actionRoute("POST", "/api/v1/claims/claim-1/review")).toEqual({
    action: "agent_review_submitted", targetId: "claim-1",
  });
  expect(actionRoute("GET", "/events/stream")).toBeUndefined();
  expect(actionRoute("GET", "/api/v1/events")).toBeUndefined();
  expect(actionRoute("GET", "/live.js")).toBeUndefined();
  expect(actionRoute("GET", "/readme/")).toEqual({ action: "about_viewed" });
  expect(actionRoute("GET", "/questions/question-1/")).toEqual({
    action: "question_viewed", targetId: "question-1",
  });
});
