import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { expect, it, vi } from "vitest";
import { actionRoute, markRequestActor, observeRequest } from "../src/observability.ts";

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

it("writes one structured, attributed action without request secrets", () => {
  const req = Object.assign(new EventEmitter(), {
    method: "POST",
    url: "/questions/question-1/claims?secret=do-not-log",
    headers: { cookie: "proofroom_session=do-not-log" },
  }) as IncomingMessage;
  const res = Object.assign(new EventEmitter(), { statusCode: 201 }) as ServerResponse;
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    markRequestActor(req, "Visitor A");
    observeRequest(req, res);
    res.emit("finish");
    res.emit("close");

    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0]?.[0]);
    expect(line).not.toContain("do-not-log");
    expect(JSON.parse(line)).toMatchObject({
      kind: "proofroom_action",
      actor: "Visitor A",
      action: "claim_submitted",
      target_id: "question-1",
      status: 201,
      outcome: "finished",
    });
  } finally {
    log.mockRestore();
  }
});
