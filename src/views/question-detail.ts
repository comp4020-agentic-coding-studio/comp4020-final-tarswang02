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

// A claim/evidence card briefly illuminates once, right after the viewer who
// just submitted it is redirected back to read the page — see the .is-new
// animation in src/render.ts. There is no live push yet, so this never fires
// for a different visitor's concurrent write; only `created_at` is checked.
function isRecent(createdAt: string): boolean {
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && Date.now() - t < 15_000;
}

function renderEvidence(ev: EvidenceRow): string {
  const recentClass = isRecent(ev.created_at) ? " is-new" : "";
  return html`<div class="evidence ${ev.relation}${raw(recentClass)}">
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

// The claim is the primary node (a dot plus its own card); real evidence
// rows hang off it as side branches on a vertical spine — see .claim-head/
// .evidence-branches in src/render.ts. Nothing here is a generated graph:
// the branches are exactly this claim's own evidence rows, in the order
// they were written.
function renderClaim(claim: ClaimRow): string {
  const statusClass = claim.reviewed_at ? "reviewed" : "unreviewed";
  return html`<div class="claim ${statusClass}">
    <div class="claim-head">
      <span class="node-dot" aria-hidden="true"></span>
      <p class="claim-body">${claim.body}</p>
    </div>
    <p class="meta">
      claimed by ${claim.actor_name} — ${claim.created_at} —
      ${claim.reviewed_at ? "reviewed" : "unreviewed"}
    </p>
    ${
      claim.evidence.length === 0
        ? raw("")
        : raw(`<div class="evidence-branches">${claim.evidence.map(renderEvidence).join("")}</div>`)
    }
    <details class="add-evidence">
      <summary>Add evidence</summary>
      <form method="post" action="/claims/${claim.id}/evidence">
        <p>
          <label for="ev-body-${claim.id}">Evidence</label><br />
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
    </details>
  </div>`.__html;
}

export function renderQuestionDetail(
  q: QuestionDetail,
  actorName: string,
  error?: string,
): string {
  const body = html`
    <p><a href="/questions">&larr; All questions</a></p>
    <p class="meta kicker">asked by ${q.actor_name} — ${q.created_at}</p>
    <h1>${q.title}</h1>
    ${q.body ? html`<p>${q.body}</p>` : raw("")}
    ${error ? html`<p class="error">${error}</p>` : raw("")}

    <div class="layout">
      <div class="layout-main">
        <h2>Claims</h2>
        ${
          q.claims.length === 0
            ? html`<p>No claims yet. Add the first one in the panel here.</p>`
            : raw(q.claims.map(renderClaim).join(""))
        }
      </div>
      <aside class="layout-aside">
        <h2>Add a claim</h2>
        <form method="post" action="/questions/${q.id}/claims">
          <p>
            <label for="claim-body-${q.id}">Claim</label><br />
            <textarea id="claim-body-${q.id}" name="body" rows="3" required maxlength="4000"></textarea>
          </p>
          <button type="submit">Add claim</button>
        </form>
      </aside>
    </div>
  `;
  return page(`${q.title} — Proofroom`, body, actorName);
}
