import { html, page, raw } from "../render.ts";

export interface QuestionSummary {
  id: string;
  title: string;
  actor_name: string;
  created_at: string;
  claim_count: number;
}

export function renderQuestionList(questions: QuestionSummary[], actorName: string): string {
  const body = html`
    <h1>Questions</h1>
    <form method="post" action="/questions">
      <p>
        <label for="q-title">Question</label><br />
        <input id="q-title" name="title" required maxlength="200" style="width:100%" />
      </p>
      <p>
        <label for="q-body">Detail (optional)</label><br />
        <textarea id="q-body" name="body" rows="3" maxlength="4000"></textarea>
      </p>
      <button type="submit">Ask</button>
    </form>
    ${
      questions.length === 0
        ? html`<div class="empty-state">
            <p>No questions yet. Ask the first one above — for example,
            "Does mobile replay preserve the selected preset?"</p>
          </div>`
        : raw(
            `<ul>` +
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
  `;
  return page("Questions — Proofroom", body, actorName);
}
