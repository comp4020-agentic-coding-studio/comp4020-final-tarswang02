import { html, page, raw } from "../render.ts";

export interface EvidenceRow {
  id: string;
  relation: "supports" | "challenges";
  body: string;
  source_url: string | null;
  actor_name: string;
  created_at: string;
}

export interface ClaimRow {
  id: string;
  body: string;
  actor_name: string;
  created_at: string;
  reviewed_at: string | null;
  evidence: EvidenceRow[];
}

export interface QuestionDetail {
  id: string;
  title: string;
  body: string;
  actor_name: string;
  created_at: string;
  claims: ClaimRow[];
}

function renderEvidence(ev: EvidenceRow): string {
  return html`<div class="evidence ${ev.relation}">
    <strong>${ev.relation === "supports" ? "Supports" : "Challenges"}</strong>
    <p>${ev.body}</p>
    ${
      ev.source_url
        ? html`<p><a href="${ev.source_url}" rel="noopener noreferrer">${ev.source_url}</a></p>`
        : raw("")
    }
    <p class="meta">${ev.actor_name} — ${ev.created_at}</p>
  </div>`.__html;
}

function renderClaim(claim: ClaimRow): string {
  return html`<div class="claim">
    <p>${claim.body}</p>
    <p class="meta">
      claimed by ${claim.actor_name} — ${claim.created_at} —
      ${claim.reviewed_at ? "reviewed" : "unreviewed"}
    </p>
    ${raw(claim.evidence.map(renderEvidence).join(""))}
    <form method="post" action="/claims/${claim.id}/evidence">
      <p>
        <label for="ev-body-${claim.id}">Add evidence</label><br />
        <textarea
          id="ev-body-${claim.id}"
          name="body"
          rows="2"
          required
          maxlength="4000"
        ></textarea>
      </p>
      <p>
        <label><input type="radio" name="relation" value="supports" checked /> supports</label>
        <label><input type="radio" name="relation" value="challenges" /> challenges</label>
      </p>
      <p>
        <label for="ev-source-${claim.id}">Source URL (optional)</label><br />
        <input
          id="ev-source-${claim.id}"
          name="source_url"
          type="url"
          maxlength="2000"
          placeholder="https://..."
        />
      </p>
      <button type="submit">Add evidence</button>
    </form>
  </div>`.__html;
}

export function renderQuestionDetail(
  q: QuestionDetail,
  actorName: string,
  error?: string,
): string {
  const body = html`
    <p><a href="/questions">&larr; All questions</a></p>
    <h1>${q.title}</h1>
    ${q.body ? html`<p>${q.body}</p>` : raw("")}
    <p class="meta">asked by ${q.actor_name} — ${q.created_at}</p>
    ${error ? html`<p class="error">${error}</p>` : raw("")}

    <h2>Claims</h2>
    ${
      q.claims.length === 0
        ? html`<p>No claims yet.</p>`
        : raw(q.claims.map(renderClaim).join(""))
    }

    <h2>Add a claim</h2>
    <form method="post" action="/questions/${q.id}/claims">
      <p>
        <label for="claim-body-${q.id}">Claim</label><br />
        <textarea id="claim-body-${q.id}" name="body" rows="3" required maxlength="4000"></textarea>
      </p>
      <button type="submit">Add claim</button>
    </form>
  `;
  return page(`${q.title} — Proofroom`, body, actorName);
}
