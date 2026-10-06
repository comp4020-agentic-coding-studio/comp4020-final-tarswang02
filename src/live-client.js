// Progressive enhancement: every write still works as an ordinary HTML form.
// SSE only notifies this page that durable records changed. The server remains
// authoritative; we fetch its current HTML and merge records into the page.
(() => {
  const region = document.querySelector("#live-records[data-live-scope]");
  if (!region) return;
  const status = document.querySelector(".live-status");
  if (!("EventSource" in window)) {
    if (status) status.textContent = "Live updates unavailable — refresh for new records.";
    return;
  }

  let refreshing = false;
  let queued = false;
  const scope = region.dataset.liveScope;
  const questionId = region.dataset.questionId;

  function mergeQuestion(next) {
    const known = new Map(
      [...region.querySelectorAll("[data-claim-id]")].map((node) => [node.dataset.claimId, node]),
    );
    const incomingClaims = [...next.querySelectorAll("[data-claim-id]")];
    if (incomingClaims.length) region.querySelector("[data-empty-claims]")?.remove();

    for (const incoming of incomingClaims) {
      const existing = known.get(incoming.dataset.claimId);
      if (!existing) {
        region.append(incoming.cloneNode(true));
        continue;
      }
      // Keep the existing disclosure, its draft and the focused input. Only
      // update mutable review metadata and append genuinely new evidence.
      existing.className = incoming.className;
      const oldMeta = existing.querySelector(":scope > .meta");
      const newMeta = incoming.querySelector(":scope > .meta");
      if (oldMeta && newMeta) oldMeta.textContent = newMeta.textContent;
      const oldReviews = existing.querySelector(":scope > .review-notes");
      const newReviews = incoming.querySelector(":scope > .review-notes");
      if (oldReviews && newReviews) oldReviews.innerHTML = newReviews.innerHTML;
      const oldReviewForm = existing.querySelector(":scope > .add-review");
      const newReviewForm = incoming.querySelector(":scope > .add-review");
      if (oldReviewForm && newReviewForm && !oldReviewForm.querySelector("textarea")?.value) {
        const oldVersion = oldReviewForm.querySelector('[name="expected_version"]');
        const newVersion = newReviewForm.querySelector('[name="expected_version"]');
        if (oldVersion && newVersion) oldVersion.value = newVersion.value;
      }
      const oldBranches = existing.querySelector(":scope > .evidence-branches");
      const newBranches = incoming.querySelector(":scope > .evidence-branches");
      if (!oldBranches || !newBranches) continue;
      const ids = new Set(
        [...oldBranches.querySelectorAll("[data-evidence-id]")].map((node) => node.dataset.evidenceId),
      );
      for (const evidence of newBranches.querySelectorAll("[data-evidence-id]")) {
        if (!ids.has(evidence.dataset.evidenceId)) oldBranches.append(evidence.cloneNode(true));
      }
    }
  }

  async function refresh() {
    if (refreshing) { queued = true; return; }
    refreshing = true;
    try {
      const response = await fetch(location.pathname, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error(`snapshot ${response.status}`);
      const documentCopy = new DOMParser().parseFromString(await response.text(), "text/html");
      const next = documentCopy.querySelector("#live-records[data-live-scope]");
      if (!next || !region.isConnected) throw new Error("snapshot missing live records");
      if (scope === "questions") region.innerHTML = next.innerHTML;
      else mergeQuestion(next);
      region.dataset.since = next.dataset.since;
    } catch {
      if (status) status.textContent = "Connection interrupted — retrying…";
    } finally {
      refreshing = false;
      if (queued) { queued = false; void refresh(); }
    }
  }

  const stream = new EventSource(`/events/stream?since=${encodeURIComponent(region.dataset.since || "0")}`);
  stream.addEventListener("open", () => {
    if (status) status.textContent = "Live updates on";
    void refresh(); // Reconcile after disconnects even if replay is truncated.
  });
  stream.addEventListener("error", () => {
    if (status) status.textContent = "Reconnecting live updates…";
  });
  stream.addEventListener("message", (message) => {
    let event;
    try { event = JSON.parse(message.data); } catch { return; }
    const sameQuestion = event.payload?.questionId === questionId;
    const affectsList = ["question_created", "claim_created", "actor_renamed"].includes(event.type);
    if ((scope === "questions" && affectsList) ||
        (scope === "question" && (sameQuestion || event.type === "actor_renamed"))) {
      void refresh();
    }
  });
  window.addEventListener("pagehide", () => stream.close(), { once: true });
})();
