# ApplyIQ improvement plan

ApplyIQ should help a job seeker decide which opportunities deserve attention, prepare an accurate application, and remember the next action. The next release should connect those steps around each saved job, building on the tracker, résumé vault, job-link checks, and AI analysis.

## Current product references

These public product pages were reviewed on November 2 2026. Their features are useful design references, not evidence that adopting a feature will improve hiring outcomes.

| Product | Useful reference | ApplyIQ opportunity |
| --- | --- | --- |
| [Teal](https://www.tealhq.com/tools/job-tracker) | Browser bookmarking, application checklists, follow-up templates, and contacts attached to jobs. | Make capture faster and give each application a next action and due date. |
| [Huntr](https://help.huntr.co/en/articles/12640406-understanding-the-job-card) | A job card brings together descriptions, dates, interviews, offers, and documents. | Preserve the posting and exact materials used for each application. |
| [Simplify Copilot](https://simplify.jobs/copilot) | Form autofill, tailored answers, and automatic tracking of submitted applications. | Start with a reusable answer library and reliable capture before broad autofill support. |
| [Jobscan](https://www.jobscan.co/) | Keyword-gap reports, résumé improvement tools, and interview practice. | Explain suggestions with quoted requirements and actual résumé evidence. |

The crowded feature set makes another generic cover-letter generator a weak product focus. A promising direction is a trustworthy workspace that keeps the job, candidate evidence, application materials, and follow-up history together. Validate that direction with users before expanding the feature set.

## Foundation delivered in this maintenance pass

- Restored Supabase, applied missing columns and hardening functions, and verified account isolation with disposable records.
- Updated dependencies, checked compatibility exceptions, and removed production audit findings.
- Added visible save status, ordered retries, atomic default-résumé selection, and server-enforced plan limits.
- Corrected Stripe mappings, checkout coordination, trial eligibility, current price display, and webhook error handling.
- Hardened posting requests and DOCX previews; removed random résumé scores and sample analytics.
- Added mobile navigation and responsive layouts, repaired setup-wizard and job-to-analysis actions, and deferred the analytics bundle until needed.

Before accepting real payments, complete the Stripe lifecycle tests and hosted Auth/settings checks in [TESTING.md](TESTING.md). Billing was verified in test mode.

## Milestone 1 Complete job workspace — implemented

Implemented flow: save a job, choose a résumé snapshot, review an analysis, save application materials, record submitted versions, and set a next action.

The workspace now includes captured description text, a chosen résumé version, saved analyses and cover-letter versions, application dates, submission records, and a status-change timeline. Text remains available after the source closes. Creation checks normalized URLs and company/role matches and asks for confirmation when a similar application exists.

Backend verification used disposable accounts to test isolation, immutable snapshots, concurrent retries, complete-bundle rollback, and submission references. Browser verification covered save/reload, version editing, exact submitted materials, a next-action due date, duplicate confirmation, and a 390px viewport. Analysis fixtures were synthetic; paid provider calls were mocked. See [TESTING.md](TESTING.md) for repeatable checks and remaining launch work.

Completion criteria:

- Reopening a job shows exactly which résumé and cover letter the user submitted.
- Editing a résumé does not silently alter an earlier submitted version.
- Refreshing, retrying, or losing a connection does not create duplicate applications or hide an unsaved change.
- A saved job remains useful after its source expires.

## Milestone 2 Show what needs attention today — next

Add a Today view with interviews, deadlines, user-set follow-up dates, and incomplete tasks. Attach recruiter/referral contacts and notes to jobs. Offer calendar export and editable follow-up drafts. Keep external sending under the user's control.

Completion criteria:

- Every reminder has a date, time zone, destination, and completion/dismiss control.
- Users can understand why an item appears today and change its schedule.
- Follow-up drafts use the correct job/contact and remain editable before sending.

## Milestone 3 Make AI suggestions traceable and editable

Add a requirement-by-requirement view: job requirement, supporting résumé passage, gap or uncertainty, and suggested wording. Keep scores advisory. Never add a qualification, achievement, or number the candidate has not supplied.

Provide side-by-side résumé edits with individual accept/reject controls, a reusable answer library, and interview practice based on the job and candidate examples. Export the approved materials.

Completion criteria:

- Each substantive suggestion points to its source requirement or candidate evidence.
- Missing evidence appears as a gap or question, rather than an invented claim.
- Users can accept individual edits and recover the original.
- Output belongs to the correct job and résumé version.

## Milestone 4 Reduce capture and preparation time

First improve paste-a-link and paste-a-description capture with a review step. Then prototype an extension for a small, tested set of job sites. Capture the source once and prefill known answers; require review before submitting an application.

Broad autofill needs ongoing site-specific maintenance. Measure time saved on the common capture flow before expanding coverage.

Completion criteria:

- Supported examples import without retyping company, role, and description.
- Blocked pages have a clear manual fallback.
- Unsupported pages never claim a successful import.

## Milestone 5 Measure progress from real events

Record application, interview, offer, and rejection events prospectively. Use those dates for response times and conversion charts. Today's status breakdown must not be presented as historical conversion data.

Add data export, account/data deletion controls, and a clear explanation of which résumé content goes to the AI provider. Review the Free allowance after observing use: established products offer substantial free tracking, so charging for higher-value preparation may be more attractive than restricting the basic tracker.

## Performance and cost work

| Priority | Change | Measure of completion |
| --- | --- | --- |
| First | Debounce/coalesce note saves while preserving final write order. | Typing saves the final text with fewer requests; failure/retry tests pass. |
| First | Cache analysis per account using job-content hash, résumé version, model, and prompt version. | Unchanged work avoids another paid call; changed inputs invalidate the cache. |
| Next | Load résumé metadata separately from full text and paginate large boards. | Initial dashboard requests stay bounded as accounts grow. |
| Next | Separate high-frequency editor state from navigation/account state. | Typing does not rerender unrelated screens. |
| Next | Add opt-in draft recovery across reloads with account separation and device-storage controls. | Recovered drafts never appear to a different account. |
| Before wider release | Measure representative desktop and phone flows. | Target p75 LCP below 2.5 seconds and interaction latency below 200 ms; record measurements before claiming success. |

Track AI cost per completed application, failed-fetch rate, save failure/recovery rate, and time to first saved job. Use those measurements to choose model/caching changes and pricing limits.

The hosted performance advisor still reports seven [RLS initialization-plan warnings](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) in older account/application policies. The new workspace policies already use cached `auth.uid()` subqueries and ownership indexes. Optimize the older policies in a separate measured migration. Keep new reference indexes until representative usage justifies removing them; an unused-index notice alone is insufficient evidence. Also review the hosted Postgres minor version against the [Supabase changelog](https://supabase.com/changelog/tzdata-local-time-vancouver-edmonton-casablanca) before a wider release.

## Validate before expanding

Observe a small set of consenting job seekers using Milestone 1. Look for repeated typing, lost documents, forgotten next steps, and suggestions they distrust. First measure whether they can create a useful saved application workspace without assistance. Then check whether they return and use the materials in a real application.

Choose the next milestone from those observations. A match score, generated document, or saved job does not establish an interview or offer.
