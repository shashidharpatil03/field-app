# AI usage note

**Shashidhar Patil. Better Cotton practical assessment, Field Data Collection App (Farmer Data module).**

## Tools and what I used them for

I used **Claude** (Claude Code and the Claude app) throughout: scoping, React and FastAPI code, the offline layer, quick rule-checking scripts, git help, and **design mock-ups** (phone-sized screens to compare before any code). I also asked **Figma's AI** for a second opinion on some screens. I worked in small steps, and tested outputs before moving on to next changes.

## Example prompts

1. *"I am thinking of making the UI even more user friendly.  Currently there are 3 buttons to view last year's data completely. I think when they click on Farmer Data on the home screen, 'Last year' button should be selected by default. and in the list of farmers, it should show all the farmers from last year with appropriate tag (still to update, continued or dropped out). The 3 buttons on the top should still work to filter by them. There should be more informatio below the LG Code - number of farmers dropped out, continued, still to udpate. This should match the formatting from the top. For this year's farmers, it should directly open 'All this year' with again appropriate flags for each farmer and proper numbers for each LG (continued and newly added). Create a mock up for this. Create more mock ups if you can think of even easier options"* 

2. *"Can't we save everything on the phone first regardless of internet? and then send it to the server only when there is internet? ... what do you think?"* I asked for an opinion first. The AI read the sync code and found most of it already existed.

3. *"Same screen should show up for all types of farmers... still to update farmer should never be allowed directly mark as all details correct."* A rule from my field experience, turned into mock-ups, then code.

## Where the AI got things wrong, and the fix

- **Colours and layout.** Dropped out was too close to Still to update; label boxes had uneven heights; the number strip stopped short of the card edge. The list also sorted by status, not farmer code. I spotted each on screen and had them fixed; Dropped out is now grey.
- **Wrong error shape.** The rule "farmers of a dropped group cannot be changed" returned plain text where the form expected field errors, so no message would show. Found while reading the response; fixed.
- **Slow Save.** Saves waited for the server and a full data refresh. I questioned it; Save now stores on the phone first and sends by itself.

## Decisions I made myself

- The module, the journey and the business rules: only the PU manager adds, drops, deletes or restores learning groups; LG numbers and facilitator codes are never reused; a new farmer can only be deleted, not dropped; the latest change wins; a facilitator who has left loses access.
- A still-to-update farmer must go through every answer before confirming. No "all correct" shortcut.
- One details screen for every farmer, few questions per screen, big buttons at the bottom.
- I dropped a bigger home-screen redesign and went back to an earlier commit, because the simpler version was easier to use. The redesign is kept as a backup branch.
- Trade-off accepted: with phone-first saving, a refused change shows later on the Sync screen, not at Save.

## How I checked

I ran the app myself online and offline, and on a real phone through my laptop's hotspot. The AI cannot run the app, so I judged every screen myself. There are **no automated tests yet**; this is listed in the README.
