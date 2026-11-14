# Food Go client prototype

An independent, fully local interaction prototype for client presentations. Production code in `apps`, `packages` and `supabase` is separate.

## Open the demo

Double-click `index.html`, or drag it into Chrome or Edge. Everything runs locally with no installation, internet connection, API key or account.

For a local HTTP preview, run these commands from this folder:

```powershell
npm start
```

Open [the local prototype](http://127.0.0.1:4173). Stop the server with Ctrl+C. An optional `PORT` environment variable changes the default port.

## A five-minute client walkthrough

1. Start on Explore. Drag the illustrated map, zoom, move the explorer using the walking controls or keyboard arrows, and search by dish, venue, cuisine or suburb. Switch between Map and List or try a category.
2. Open Finch & Field. Save it, inspect the menu and field notes, then choose **Let's go here**. Select **Arrive at this stop** and **Simulate QR check-in**. The first visit adds 50 example XP and a VenueDex entry.
3. Choose **Discover the signature dish**, **I tried this dish**, then **Simulate staff confirmation**. Dish collection has its own FoodDex entry and reward. A venue visit does not automatically collect a dish.
4. Open Quests and start **Coffee and a bakery stop**. Check in at Small Hours and Corner Roast, then return to the quest and claim the 100 XP completion reward. The quest, dish, daily and first-visit rewards cannot be claimed repeatedly.
5. Open the passport to show level progress, earned badges, activity, editable explorer name and preferences. Try Community and Rewards. On mobile, these sections and Partner studio are available through the passport shortcuts.
6. In Partner studio, try **Add or claim a venue**, **Use example details**, and complete the three-step onboarding. Review the submission in the simulated operator queue. Explore My venue, Menu, Offers, Team and Subscription.
7. Use **Help & demo guide** or **My passport > Reset demo** before the next presentation.

## Coverage

| Area | Interactive behaviour |
| --- | --- |
| Explore | Illustrated adventure map, explorer avatar and radar, food encounters, drag, zoom, walking controls, routes, arrival, search, categories, city selection and list view |
| Venue detail | Save, menu, example reviews, note preview, report preview, booking enquiry preview and example offers |
| FoodDex | All dishes, wishlist, collected dishes and separate simulated dish verification |
| VenueDex | All places, saved places and simulated visits |
| Quests | Start, continue, leave, stop progress, completion and one-time XP rewards |
| Passport | Levels, XP, badges, activity, name editing, private-profile preference and reset |
| Accounts | Demo sign-in, registration, recovery, sign-out and identity deletion |
| Rewards | Daily example XP, offer details, reward codes and single-use simulated redemption |
| Community | Example rankings, follow/unfollow, campaign trail and copyable invitation preview |
| Partner | Venue search/claim, three-step onboarding, validation, edit/back/reset, listing preview, venue details and hours, photo choices, menu editing, offers, local team, subscription preview and operator decisions |

The three original example venues and quests are retained. Three additional fictional places make the illustrated map and trails useful for the demo. Melbourne is the only populated city. Other Australian cities have an empty state and a return path.

## Demo boundaries

The app starts with a fictional explorer named Alex, level 3 and 320 example XP. It uses original SVG map artwork and the existing food photos. No Pokemon characters, branding or game assets are used.

Location, QR scanning, dish verification, accounts, rewards, venue publication, reviews, bookings, subscriptions and payments are simulated. No camera or location permission is requested, no email is sent, no real payment is taken, and no listing or review is published. This is a browser prototype, including at phone widths, rather than a native mobile build.

Example explorer progress, bookmarks, settings and name are saved under the browser key `food-go-prototype-v1`. Credentials and booking input are never saved or sent. Restaurant edits and the simulated operator queue stay in page memory and clear on reload. Editing the existing Finch & Field listing, photo or signature dish updates the shared example record for this session. A new onboarding draft stays separate from that listing. Storage can behave differently for `file:` URLs; use the local server when persistence matters during a presentation.

## Asset credits

The locally copied photos retain the existing project's [asset credits](../docs/assets.md) and Unsplash licence: brunch by Lacey Williams, pizza by Diego Arenas de Rodrigo, and coffee by Inc inductgroup. Photography is illustrative and does not identify the fictional venues.

## Verification

Run `npm run check` from this folder for JavaScript syntax checks. Browser walkthrough evidence and viewport checks are recorded in [verification.md](verification.md).
