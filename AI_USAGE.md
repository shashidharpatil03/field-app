# AI usage note

**Shashidhar Patil. Better Cotton practical assessment, Field Data Collection App.**

## Tools and what I used them for

I used **Claude** (Claude Code inside the Claude app) throughout: scoping, writing and editing the React and FastAPI code, building the offline layer, writing throwaway scripts to check rules, and git help. I worked in small steps, one change at a time, ran each change myself, and asked for every new concept to be explained. I am newer to React and FastAPI, so I used the AI as a teacher as well as a builder.

## Example prompts

1. *"What are things to consider before building offline for the PU manager, pros or cons?"* I asked for trade-offs before any code.
2. *"Yes build the PUM offline functionality, without the admin feature. In the 'Sent' menu, time stamp is not recorded if the data was submitted offline. This should record the time of syncing with server."* I set the scope and found the bug while using the app.
3. *"Remove the reason for change. It does not give an option to review responses when editing farmer data. Please bring it back."* I noticed a Review step had been lost along with it.

## Where the AI got things wrong, and the fix

- **Review step lost** when "Reason for change" was removed. I found it by using the form; it is now a proper Review step.
- **Preview could not sign in.** The offline test copy runs on a different port, which the backend did not allow. I saw "Could not load the users"; the missing port was added.
- **Silent edit failure.** A code formatter re-wrapped an import, so a scripted edit did not apply and the offline layer crashed on an undefined value. A test script caught it.
- **Wrong field name** on the "waiting to send" screen, which showed blank names. Found in review and fixed.
- **Duplicate translation keys** and **compiled Python files committed to git.** Removed, and the files are now ignored.

## Decisions I made myself

- The module and journey: a PU manager sets up learning groups and facilitators; a facilitator registers and updates farmers, reviews, sends, and sees what was sent.
- The business rules: only the PU manager adds, drops, deletes or restores a learning group; LG numbers and facilitator codes are never reused; a new farmer can only be deleted, not dropped; the latest change wins; a facilitator who has left loses access.
- Offline for facilitators first, then for the PU manager **without** admin actions, because admin changes affect other people and should be checked online.
- Sent shows when the server received a record, not when it was typed.

## How I checked

I ran the app myself, including offline mode in the browser, and reported what I saw. I have **not yet tested on a real phone**, and there are no automated tests yet. Both are listed as next steps in the README.
