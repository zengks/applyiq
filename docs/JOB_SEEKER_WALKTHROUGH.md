# Protected job seeker pilot

Use this guide with 8–12 consenting job seekers who tailor applications and manage several roles at once. The protected preview is for supervised sessions. The moderator needs Vercel access and each participant uses a separate disposable ApplyIQ account. Prepare the account before the call so sign-in and onboarding do not contaminate the task timing. The existing [synthetic fixture instructions](TESTING.md#today-and-draft-recovery-verification) cover a moderator dry run and cleanup. For participant tasks, start with an empty job board so a sample can be saved without hitting the five-job limit.

Use this invitation once a participant has been identified and approved for contact:

> I’m testing a tool for organizing job applications. Would you be open to a 25-minute walkthrough using a sample job and résumé? I’d ask you to try a few tasks and tell me where you get stuck. You can skip anything or stop at any time.

For independent week-one observation, use approved individual access to the protected preview and a separate account for each participant. If the moderator is the only person with preview access, record the follow-up as supervised.

## Session script (25 minutes)

1. Ask permission to observe and take anonymous notes. Explain that the participant can skip any task or stop. Use a synthetic or redacted résumé and the sample postings below. Ask separately before recording or following up. The session ends at a saved submission record and a copied draft, before any actual submission or outreach.
2. Have the participant use their usual tools for one scenario and ApplyIQ for the other. Alternate which tool and scenario come first across sessions. If their usual process skips one of the tasks, record that as their baseline. Use the same task instructions and start the timer when they receive the posting.
3. Ask them to save the posting, attach or prepare a tailored résumé and cover letter, and record the versions they would submit. Ask them to add a dated follow-up. Record elapsed time to the first saved job with a next step and to the complete submission record separately. Use the sample text for the dry run and omit live AI generation. Treat comments on the synthetic analysis as qualitative feedback.
4. After a short unrelated task, ask them to find the exact saved résumé and cover letter again and show what is due next. If useful, ask them to schedule the sample interview and copy an editable follow-up draft. Ask what they would keep using, where they hesitated, and which work they had to repeat. Record prompts given by the moderator separately from unassisted completion.
5. With separate consent, check one week later whether a participant who is still searching used ApplyIQ again. Record the task they returned for and whether they initiated it themselves. If testing from a phone, record the device and browser and note keyboard, scrolling, and date-picker issues.

### Sample candidate and postings

**Candidate** — Morgan Lee built a React component library for a service portal, added keyboard checks, wrote TypeScript tests, and worked with a designer to replace inconsistent controls. Morgan documented accessibility fixes and investigated a slow dashboard query. The sample supplies no people-management experience, metrics, or certifications.

**A. Northstar Studio, Frontend Engineer** — Maintain an accessible React component library. Work with designers on keyboard behavior and write TypeScript tests. Experience profiling web performance is preferred. Follow up in three days.

**B. Cedar Labs, Product Engineer** — Improve accessibility in a React dashboard. Pair with designers, add tests to TypeScript components, and investigate performance problems. Experience leading a small team is preferred. Follow up in three days.

For each posting, reuse or adapt this sample letter opening: “I’m interested in the role because it combines product work with accessibility. I helped build a React component library, worked with a designer on keyboard behavior, and added TypeScript tests.” A participant can edit the letter before recording a submission and make a second edit afterward. Ask which version was recorded as sent.

## Scorecard

Record only participant codes and observations. Keep contact and scheduling information separately from results. Fill the two time fields for both tools, leaving a blank if a step was skipped or blocked. Store the completed sheet outside Git.

| Participant code | Tool and scenario order | First job + step time | Complete submission time | Exact materials recovered unaided? | Main friction and prompts given | Returned in week one? |
| --- | --- | --- | --- | --- | --- | --- |
| P01 |  |  |  |  |  |  |

After the first 10 sessions, compare the count completing without help, median capture time, paired total preparation times, exact-version retrieval, and repeated friction. Initial targets are at least 8 of 10 uncoached completions and a median below three minutes for first job plus next action. Report the return count with the number still searching and available for follow-up. Treat the sample as directional.

- If repeat typing or blocked imports dominate, build the paste-and-review screen first. Compare median task time on the same cases before and after.
- If participants hesitate to use edits they cannot verify, start with requirement, résumé evidence, and approve/reject for a few common suggestions. Evaluate approved output on labeled test cases before exposing it to more users.
- If participants recover versions only with help, fix the submission and retrieval controls before adding features.
