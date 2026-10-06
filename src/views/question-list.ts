import { html, page, raw } from "../render.ts";
import { latestEventSeq } from "../db.ts";

export interface QuestionSummary {
  id: string;
  title: string;
  actor_name: string;
  created_at: string;
  claim_count: number;
}

export function renderQuestionList(
  questions: QuestionSummary[],
  actorName: string,
  error?: string,
  draft?: { title: string; body: string },
): string {
  const body = html`
    <h1>Questions</h1>
    <p class="live-status meta" role="status" aria-live="polite">Connecting live updates…</p>
    <div class="layout entry-first">
      <aside class="layout-aside">
        <h2>Ask a question</h2>
        <form method="post" action="/questions">
          ${error ? html`<p class="error">${error}</p>` : raw("")}
          <p>
            <label for="q-title">Question</label><br />
            <input
              id="q-title"
              name="title"
              required
              maxlength="200"
              style="width:100%"
              value="${draft?.title ?? ""}"
            />
          </p>
          <p>
            <label for="q-body">Detail (optional)</label><br />
            <textarea id="q-body" name="body" rows="3" maxlength="4000">${draft?.body ?? ""}</textarea>
          </p>
          <button type="submit">Ask</button>
        </form>
      </aside>
      <div class="layout-main" id="live-records" data-live-scope="questions" data-since="${latestEventSeq()}">
        ${
          questions.length === 0
            ? html`<div class="empty-state">
                <p>No questions yet. Ask the first one with the form here — for
                example, "Does mobile replay preserve the selected preset?"</p>
              </div>`
            : raw(
                `<ul class="question-list">` +
                  questions
                    .map(
                      (q) =>
                        html`<li>
                          <a href="/questions/${q.id}">${q.title}</a>
                          <span class="meta"
                            >— ${q.claim_count} claim(s), asked by ${q.actor_name} at
                            ${q.created_at}</span
                          >
                        </li>`.__html,
                    )
                    .join("") +
                  `</ul>`,
              )
        }
      </div>
    </div>
  `;
  return page("Questions — Proofroom", body, actorName);
}
