# Food Go browser demo

Prepared 13 November 2026 for the next day's desktop and mobile browser presentation.

## Start

From the project root with Node.js 24 and installed dependencies:

```powershell
npm run build:web
npm run start --workspace @food-go/web
```

Open **http://127.0.0.1:3000/demo** on this computer. During development, `npm run dev` is also available. These commands bind to loopback. To open the demo on a separate handset, deploy to a client-owned HTTPS preview first; the loopback address on a phone points to the phone itself.

The complete adventure is under `/demo`. Use its own navigation throughout. `/` and `/feed` are the connected catalogue/community and may correctly show no approved data. `/explore-preview` and `/feed-preview` are older isolated previews. The original `prototype` folder remains unchanged.

## Five-minute presentation

1. Open Passport and reset the adventure. Confirm the reset prompt. The example explorer begins at 320 XP. Reset clears the game, collections and example social changes in this browser.
2. Open Explore, the centre tab. The whole map fits the available screen section. Pan/zoom and use the inline arrow pad to move the explorer. On a narrow, short phone, open Map view tools or Map filters only when needed. Select a place to expose its real-area Google Maps shortcut; full actions and Apple Maps are below the scene. Open Garden Arcade to show three shops grouped by floor and unit. Optionally open Avatar below the map, preview Foodie, Trailblazer, Sky or Violet, try Wave/Celebrate/Look around, then apply. Tapping the map character waves. Original explorer remains available; game reset keeps this separate cosmetic preference.
3. Open Food trails. Start **Coffee and a bakery stop**, then continue on Explore. The trail starts its next example route. Mark arrival, then **Simulate QR check-in** and confirm. Show the +50 example XP receipt and saved visit.
4. Confirm the separate example dish with **I tried this example dish**. Open FoodDex to show collection progress. Repeat at the second trail stop, return to trails and claim the completed trail once.
5. Open Feed. Publish a public story, like another explorer's story, add a comment and share to your wall. Open My wall, then Passport. Progress and badges carry across navigation and reload. Private stories stay on My wall and do not receive public contribution XP.
6. Show daily XP, reward progress and the activity list. Editing the explorer name and resetting are available in Passport. Repeating a check-in, dish, claimed trail or daily claim does not create another reward.

If only two minutes are available: Explore -> Small Hours route/arrival/check-in -> separate dish -> Feed story -> Passport. Keep the prototype available as a reference, not as evidence that its restaurant subscriptions or staff tools are connected.

## Honest boundaries to explain

- The illustrated explorer is not the device's GPS. Arrival, QR and dish confirmations are explicit simulations. Demo XP is local, not transferable or redeemable.
- Example people, posts and engagement counts are fictional. No anonymous demo view is shown as real signed-in reach.
- The actual Supabase implementation stores and deduplicates verified-account reach and server-derived social XP separately. A live two-account browser demonstration still requires configured Auth, approved content and deployed-environment checks.
- Complete real published addresses can open Google Maps or Apple Maps directions. Fictional places open only an explicitly labelled real suburb/area search; the invented street address and illustration coordinates are never used.
- Brevo sender configuration was deferred; Mobile Message delivery requires the owner's credentials, sender and controlled test phone. The local adventure does not depend on either.
- Browser storage must be allowed for progress to survive reload. The interface reports storage failures; a private or restricted browser may clear saved progress when closed.

## Evidence

The final delivery report records exact build, test, database and browser results after the combined implementation. A passing automated test suite is not a guarantee that every device, account provider or network condition will work.

See [UI research](../research/08-game-ui-research.md), [go-live inputs and remaining gates](../launch/go-live-checklist.md), and [messaging setup](../integrations/messaging.md).
