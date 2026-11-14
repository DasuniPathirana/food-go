# Food Go: a more distinctive neighbourhood food club

Research date: 13 November 2026. This is a visual direction and product-design research note, not a claim that a style can be objectively identified as AI-generated. The useful question is whether the interface feels specific to Food Go or interchangeable with an unrelated template.

## Evidence inspected

Local visual evidence: the delivered desktop Explore, Feed and avatar chooser screenshots in `docs/screenshots/08-demo-desktop.jpg`, `08-feed-desktop.jpg` and `09-avatar-desktop.jpg`, plus current product/design guidance. These are the incumbent design, rather than generic inspiration images.

The approved illustrated neighbourhood is the most distinctive part. Its streets, dimensional food pins, avatar and radar communicate exploration immediately. The avatar chooser also has a meaningful preview/apply interaction. Those features should stay.

The weaker identity comes from the surrounding composition:

- The same cream canvas, white rounded rectangles, small outlines and pill treatments recur almost everywhere. Every component asks for similar attention, so a special collection, a story and a routine filter can look equally important.
- Fredoka is expressive, but using its soft shapes across most headings makes the whole product feel younger than its food photography and restaurant audience. Bold rounded type alone is not a brand system.
- The wide navigation sidebar and large daily reward box occupy valuable map space. The sidebar reads like a conventional dashboard more than a place to explore.
- Feed spends most of its first desktop viewport on a slogan, wall controls and a large empty composer. The screenshot shows almost none of the actual stories or food. The user has to scroll before the social proposition becomes tangible.
- Phrases such as “Good food. Better stories.” and “A good day to get out.” add a pleasant tone, but they could belong to many products. Concrete labels and actual places are stronger product content.

These are design judgements based on the current screenshots. They are not findings from user testing or a reliable detector of who authored the interface.

## Primary-source references

The following sources were opened during this research. They are product owners, the original designers or a typeface's author. Historical brand case studies are used as precedents, not represented as each company's current 2026 interface.

| Source | What the source documents | Food Go inference |
| --- | --- | --- |
| [COLLINS: Sweetgreen](https://wearecollins.com/case-studies/sweetgreen/) | A system developed from real ingredients, cooking and people, combining lighthearted illustration, custom type, food photography and earthy/vivid colour. The case also describes a consistent functional icon system. | The map can keep its playful illustration while surrounding food content feels more adult. Put photography and useful local detail ahead of decorative UI boxes. Choose a coherent visual vocabulary rather than unrelated effects. |
| [Sweetgreen's own brand-refresh explanation](https://www.sweetgreen.com/brand-refresh) | The brand links its expression to hand-drawn vintage cookbooks, the people behind the food, ingredient imperfection and cooking. | “Handmade” should come from a meaningful food/place story. Do not scatter fake paper texture or wobbly shapes across every control simply to look less digital. |
| [Pentagram: Shake Shack](https://www.pentagram.com/work/shake-shack) | The identity developed from a local park kiosk and roadside-food context. The case describes a typographic hierarchy, recognisable food icons, menu boards and a system that could extend across locations. | Food Go needs its own repeatable restaurant-and-neighbourhood language. A recognisable wordmark, menu-like hierarchy, direct labels and a small set of motifs can be expressive without making every element a cartoon. |
| [Beli's official product overview](https://beliapp.com/) | The product connects restaurant lists/maps, friends' experiences and discovery. Its own explanation is organised around tracking, sharing and discovering. | Feed should show people and food promptly, while collections and map exploration remain connected. Avoid turning a food community into a generic marketing page with a social section far below the fold. |
| [Duolingo: core tabs redesign](https://blog.duolingo.com/core-tabs-redesign/) | The team describes inconsistent hierarchy/spacing, explores different directions, then reduces type styles, uses whitespace in place of forced containers and gives headers sizes appropriate to each tab's purpose. It cautions that artwork repeated on every header can consume space without helping. | Keep one navigation and type system, but let Explore be map-led, Feed story-led and Passport collection-led. Repeating the same large heading/cards everywhere is visual consistency without enough purpose. |
| [Bricolage Grotesque: the author's repository](https://github.com/ateliertriay/bricolage) | The author describes an expressive variable family with weight, width and optical-size axes; smaller optical sizes become more neutral. The repository supplies an OFL licence. | Use an expressive display face deliberately for the brand and short titles, paired with a quieter reading face. The font does not remove the need for spacing, content hierarchy and good small text. |

The separate [GrandArmy Sweetgreen project](https://grand-army.com/projects/celebrating-real-food/) also appears in current primary search results and describes another brand system. Full page retrieval was unavailable here, so it was not used to attribute an exact current palette or typeface. One Pentagram image CDN asset returned access denied. No inaccessible image was downloaded through another path or treated as a measured reference.

## Recommended direction: the neighbourhood food club

Food Go should feel like a lively local food guide that happens to reward exploration. It can be playful enough for avatars and quests without making the entire interface look like a children's learning app. The approved map supplies the strongest world-building already; the surrounding UI should frame that world with a confident food identity.

The proposed system combines paper-like light surfaces, dark ink, an appetising tomato action colour and butter-yellow progression accents. Cobalt can remain a functional focus/wayfinding colour. This is a Food Go design decision, not a palette prescribed by the references. Colour contrast must be calculated for the final pairs and checked in the actual components.

Bricolage Grotesque for short titles and Source Sans 3 for reading is the implementation direction. The team chose the quieter humanist body face to balance the expressive headings; this is a Food Go judgement rather than a primary-source prescription. Keep the strongest expressive lettering at the wordmark and a few display moments; body text, post content, navigation and controls should remain calm and readable. Self-host approved font files and retain licences. Do not make every heading oversized or equally loud.

The identity should have a limited set of product-specific devices:

- A compact, recognisable Food Go wordmark/mark rather than a generic app icon beside text.
- Menu-like type hierarchy and deliberate dividers around food information.
- A trail ticket where a real sequence of stops and reward belongs.
- Passport stamps or collection marks for actual completion states.
- Food photography as content, with factual captions and visible provenance where needed.

These devices should appear where they explain the task. Fake postage, perforations, rotations or stickers on every surface would simply replace one template with another. Keep ordinary forms ordinary.

## Five changes with the greatest payoff

1. **Give the map more of the desktop canvas.** Use compact navigation with visible labels and a concise player/status header. Keep Explore first and centred in the phone bar. Move the oversized daily promotion into a small, reachable reward affordance. Preserve the approved scene, marker grouping, animation, pan/zoom and optional below-map panels.
2. **Let real content create the layout.** Shorten the Feed introduction and composer so stories appear sooner. Use a restrained post column, food photography and inline wall tabs. Trails can use a route/ticket composition; Passport can use a collected-stamp composition. They should share tokens, not the same container pattern.
3. **Change the type hierarchy, not only the font files.** Put stronger contrast between display, title, metadata and reading text. Reduce repeated bold rounded headings. Keep body copy at comfortable sizes and keep long text from spanning the whole desktop window.
4. **Use colour as a small number of decisions.** Tomato means decisive action/selection; yellow means XP/reward; ink means reading/navigation. The large light map and white/paper content do most of the work. Avoid tinting every card a different accent or adding decorative gradients/glass.
5. **Replace filler copy with product language.** “Community”, “Share a food story”, a real trail name and the next stop say more than repeated motivational slogans. Preserve truthful example/live states, moderation labels, avatar preview/apply semantics and reward boundaries.

## Constraints that research must not erase

The user approved the existing map behaviour and explicitly wants a light theme with stronger colours. Keep the 3D/anime avatar choices optional. Keep Feed prominent, Explore first and centred, and Passport as progress/personal-wall entry. Mall shops stay grouped behind one building marker. Optional controls reveal on demand, outside the map's working scene.

Visual redesign must preserve working quest, arrival, check-in simulation, dish collection, one-time XP, social visibility and saved-preference flows. It must not invent ratings, friends, popularity, live traffic, geographic accuracy or verified visits for decoration. Do not claim that a sourced design method guarantees satisfaction or conversion.

## Validation after implementation

Review one paired desktop/phone batch across Explore, Feed, trails, Passport and avatar options. Check the first viewport's useful content, text contrast, 44px standalone actions, visible labels, keyboard focus, one-page scrolling, storage persistence and reduced-motion paths. Verify the game/social/avatar flows after structural changes. Make one grouped correction pass from observed issues, then confirm. Physical-device performance and actual user preference still need user testing; visual references are not substitutes for that evidence.
