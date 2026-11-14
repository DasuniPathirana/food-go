(function () {
  'use strict';

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const btn = (label, action, classes = 'btn btn-secondary', attrs = '') => `<button type="button" class="${classes}" data-action="partner-${action}" ${attrs}>${label}</button>`;
  const defaultDraft = { name: '', email: '', phone: '', address: '', suburb: '', state: 'VIC', postcode: '', cuisine: '', venueType: 'cafe', description: '', gameEnabled: true, acceptedTerms: false };
  const example = { name: 'Finch & Field', email: 'hello@finchandfield.example', phone: '03 9000 1234', address: '24 Example Street', suburb: 'Fitzroy', state: 'VIC', postcode: '3065', cuisine: 'Modern Australian', venueType: 'cafe', description: 'Seasonal brunch, thoughtful coffee and a welcoming neighbourhood table in Fitzroy.', gameEnabled: true, acceptedTerms: false };
  const initialMenu = [{ id: 'toast', name: 'Avocado toast', price: '22', description: 'Sourdough, avocado, lemon and garden herbs', dietary: 'Vegetarian', canonical: 'Avocado toast' }, { id: 'coffee', name: 'Flat white', price: '5', description: 'House blend with your choice of milk', dietary: 'Vegetarian', canonical: 'Coffee' }];
  const tabs = [['overview', 'Overview'], ['venue', 'My venue'], ['menu', 'Menu'], ['offers', 'Offers'], ['team', 'Team'], ['billing', 'Subscription'], ['review', 'Operator review']];
  let currentState;

  function partner(state) {
    state.partner = state.partner || {};
    const p = state.partner;
    p.tab = p.tab || 'overview';
    p.draft = { ...defaultDraft, ...(p.draft || {}) };
    p.venue = { ...example, ...(p.venue || {}) };
    p.photo = p.photo || 'brunch';
    if (!p.menu) p.menu = initialMenu.map(item => ({ ...item }));
    if (!p.hours) p.hours = ['07:00', '15:00'];
    if (!p.offers) p.offers = [{ id: 'morning', name: 'A good morning combo', description: 'Coffee and avocado toast for $24. Weekdays before 11 am. One per explorer.', active: true }];
    if (!p.team) p.team = [{ name: 'Alex Morgan', email: 'alex@finchandfield.example', role: 'Owner' }];
    if (!p.queue) p.queue = [{ id: 'field', name: 'Finch & Field', suburb: 'Fitzroy', type: 'Ownership claim', status: 'Pending', evidence: 'Business email and example ownership document supplied.' }, { id: 'carlton', name: 'Ciao, Carlton', suburb: 'Carlton', type: 'Venue listing', status: 'Pending', evidence: 'Menu, opening hours and business details supplied.' }];
    return p;
  }

  function field(name, label, value, extra = '', type = 'text') {
    return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  }

  function heading(kicker, title, text, action = '') {
    return `<div class="page-intro"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="muted">${text}</p></div>${action}</div>`;
  }

  function onboarding(p) {
    const d = p.draft;
    const step = Math.min(2, Math.max(0, p.onboardingStep || 0));
    if (p.submitted) return `<section class="card partner-success"><div class="partner-status-stamp">READY FOR REVIEW</div><div class="eyebrow">Submission preview</div><h2>Your next chapter starts here.</h2><p>${esc(d.name)} has joined the demo review queue. An operator checks ownership before a listing appears publicly.</p><div class="partner-preview"><strong>${esc(d.name)}</strong><span>${esc(d.cuisine)} · ${esc(d.suburb)}, ${esc(d.state)}</span><p>${esc(d.description)}</p><span class="tag">${d.gameEnabled ? 'Food adventure enabled' : 'Marketplace listing'}</span><span class="tag">Awaiting review</span></div><div class="partner-actions">${btn('Open review queue', 'tab', 'btn btn-primary', 'data-tab="review"')}${btn('Edit draft', 'edit-draft')}${btn('Back to studio', 'tab', 'btn btn-secondary', 'data-tab="overview"')}</div><p class="partner-small muted">Local simulation. No venue is published and no email is sent.</p></section>`;
    let fields = '';
    if (step === 0) fields = `<div class="section-heading"><div><h2>The basics</h2><p class="muted">Tell us who is behind the good food.</p></div>${btn('Use example details', 'prefill', 'btn btn-small btn-secondary')}</div><div class="form-grid">${field('name', 'Venue name', d.name, 'required minlength="2" maxlength="120"')}${field('email', 'Business email', d.email, 'required maxlength="254"', 'email')}${field('phone', 'Business phone', d.phone, 'required minlength="8" maxlength="24"', 'tel')}</div><div class="notice">Already on Food Go? Search below to claim an existing venue and avoid a duplicate listing.</div><div class="partner-claim-search">${field('claimSearch', 'Search an existing venue', p.claimQuery || '', 'placeholder="Try Finch & Field or Fitzroy"')}${btn('Search venues', 'claim-search')}</div>${p.claimSearched ? `<div class="partner-claim-result"><div><strong>${/finch|fitzroy|field/i.test(p.claimQuery || '') ? 'Finch & Field' : /ciao|carlton/i.test(p.claimQuery || '') ? 'Ciao, Carlton' : 'No existing venue found'}</strong><p class="muted">${/finch|fitzroy|field|ciao|carlton/i.test(p.claimQuery || '') ? 'Example venue match. Claiming requires ownership review.' : 'Continue with a new venue draft.'}</p></div>${/finch|fitzroy|field|ciao|carlton/i.test(p.claimQuery || '') ? btn(p.claimed ? 'Claim added to draft' : 'Claim this venue', 'claim', 'btn btn-small btn-secondary') : ''}</div>` : ''}`;
    if (step === 1) fields = `<h2>Your venue</h2><p class="muted">The details explorers need before their first visit.</p><div class="form-grid">${field('address', 'Street address', d.address, 'required minlength="5" maxlength="200"')}${field('suburb', 'Suburb', d.suburb, 'required minlength="2" maxlength="100"')}<label class="field"><span>State or territory</span><select name="state">${['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'].map(v => `<option ${d.state === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>${field('postcode', 'Postcode', d.postcode, 'required pattern="[0-9]{4}" maxlength="4" inputmode="numeric"')}${field('cuisine', 'Cuisine', d.cuisine, 'required minlength="2" maxlength="60"')}<label class="field"><span>Venue type</span><select name="venueType">${[['cafe', 'Cafe'], ['restaurant', 'Restaurant'], ['market', 'Food market']].map(([v, l]) => `<option value="${v}" ${d.venueType === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="field full"><span>Your story</span><textarea name="description" required minlength="20" maxlength="1000" rows="3">${esc(d.description)}</textarea></label></div><label class="check-row"><input type="checkbox" name="gameEnabled" ${d.gameEnabled ? 'checked' : ''}><span>Join the adventure. Let explorers discover this venue through quests and check-ins.</span></label>`;
    if (step === 2) fields = `<h2>Review your draft</h2><p class="muted">One listing for the marketplace and the food adventure.</p><dl class="partner-review"><div><dt>Venue</dt><dd>${esc(d.name)}</dd></div><div><dt>Contact</dt><dd>${esc(d.email)}<br>${esc(d.phone)}</dd></div><div><dt>Location</dt><dd>${esc(d.address)}<br>${esc(d.suburb)}, ${esc(d.state)} ${esc(d.postcode)}</dd></div><div><dt>Food and style</dt><dd>${esc(d.cuisine)} · ${esc(d.venueType)}</dd></div><div><dt>Your story</dt><dd>${esc(d.description)}</dd></div><div><dt>Food adventure</dt><dd>${d.gameEnabled ? 'Participating' : 'Marketplace only'}</dd></div></dl><label class="field"><span>Ownership evidence</span><select name="evidence"><option>Business email and example document</option><option>Staff-authorised example claim</option><option>Manual review requested</option></select></label><label class="check-row"><input type="checkbox" name="acceptedTerms" required ${d.acceptedTerms ? 'checked' : ''}><span>I am authorised to manage this example venue and understand this is a demo submission.</span></label>`;
    return `<div class="partner-onboarding"><aside><div class="eyebrow">Restaurant onboarding</div><h2>Put your place<br>on the map.</h2><p class="muted">Your food. Your story. A whole city of curious explorers.</p><ol class="partner-steps">${['The basics', 'Your venue', 'Review your draft'].map((title, index) => `<li class="${index === step ? 'current' : index < step ? 'done' : ''}"><span>${index + 1}</span>${title}</li>`).join('')}</ol><p class="partner-small muted">Example details only. Changes stay in this browser.</p></aside><section class="card"><form id="partner-onboarding-form">${fields}<div class="partner-form-error" role="status"></div><div class="partner-actions">${btn(step ? 'Back' : 'Cancel', step ? 'back' : 'cancel-onboarding')}${btn(step === 2 ? 'Submit for demo review' : 'Continue', step === 2 ? 'submit' : 'next', 'btn btn-primary')}</div></form></section></div>`;
  }

  function overview(p) {
    return `${heading('Restaurant studio', 'Good food. New faces.', 'Everything your neighbourhood needs to discover your place.', btn('Add or claim a venue', 'start-onboarding', 'btn btn-primary'))}<div class="grid-3 partner-stats"><div class="stat-card"><span>Discovery views</span><strong>1,248</strong><small>Example activity this month</small></div><div class="stat-card"><span>Explorer visits</span><strong>86</strong><small>Example check-ins</small></div><div class="stat-card"><span>Saved by explorers</span><strong>214</strong><small>Example collection saves</small></div></div><div class="grid-2"><section class="card partner-feature-card"><div class="eyebrow">Your neighbourhood table</div><h2>${esc(p.venue.name)}</h2><p class="muted">${esc(p.venue.cuisine)} · ${esc(p.venue.suburb)}, VIC</p><p>${esc(p.venue.description)}</p><div class="partner-actions"><span class="tag">${p.venue.gameEnabled ? 'Adventure enabled' : 'Marketplace only'}</span><span class="tag">Demo venue</span></div>${btn('Manage venue', 'tab', 'btn btn-secondary', 'data-tab="venue"')}</section><section class="card"><div class="eyebrow">Make the next visit happen</div><h2>A little reason to explore.</h2><p class="muted">Your signature dishes appear in FoodDex. Offers give explorers a reason to stop by.</p><div class="partner-activity"><span>Menu ready</span><strong>${p.menu.length} dishes</strong></div><div class="partner-activity"><span>Active offers</span><strong>${p.offers.filter(o => o.active).length}</strong></div><div class="partner-actions">${btn('Edit menu', 'tab', 'btn btn-secondary', 'data-tab="menu"')}${btn('Create offer', 'tab', 'btn btn-secondary', 'data-tab="offers"')}</div></section></div><section class="card"><div class="section-heading"><div><div class="eyebrow">From draft to discovery</div><h2>A simple route onto the map.</h2></div>${btn('Start onboarding', 'start-onboarding', 'btn btn-small btn-secondary')}</div><div class="grid-3 partner-process"><div><span>01</span><h3>Claim your place</h3><p class="muted">Find an existing venue or create a new listing.</p></div><div><span>02</span><h3>Make it yours</h3><p class="muted">Add your story, dishes and opening hours.</p></div><div><span>03</span><h3>Ready for review</h3><p class="muted">An operator reviews ownership before publishing.</p></div></div></section>`;
  }

  function venue(p) {
    const d = p.venue;
    return `${heading('Venue management', 'Your place, in your words.', 'Keep your listing useful and make every first visit feel familiar.')}<section class="card"><form id="partner-venue-form"><div class="form-grid">${field('name', 'Venue name', d.name, 'required minlength="2"')}${field('cuisine', 'Cuisine', d.cuisine, 'required')}${field('address', 'Street address', d.address, 'required')}${field('suburb', 'Suburb', d.suburb, 'required')}<label class="field full"><span>Venue story</span><textarea name="description" required minlength="20" rows="3">${esc(d.description)}</textarea></label>${field('open', 'Opening time, Monday to Sunday', p.hours[0], 'required', 'time')}${field('close', 'Closing time, Monday to Sunday', p.hours[1], 'required', 'time')}</div><label class="check-row"><input type="checkbox" name="gameEnabled" ${d.gameEnabled ? 'checked' : ''}><span>Participate in quests and allow demo check-ins</span></label><div class="partner-actions">${btn('Save venue changes', 'save-venue', 'btn btn-primary')}${btn('Preview listing', 'preview-venue')}</div></form>${p.previewListing ? `<div class="partner-preview"><span class="eyebrow">Listing preview</span><h3>${esc(d.name)}</h3><p>${esc(d.description)}</p><p class="muted">${esc(d.suburb)} · ${esc(d.cuisine)} · ${esc(p.hours[0])} to ${esc(p.hours[1])}</p></div>` : ''}</section><section class="card"><h2>Venue photography</h2><p class="muted">Keep the first impression true to your place. The demo uses existing Food Go food photography.</p><div class="partner-photo-options">${['brunch', 'pizza', 'coffee'].map(photo => `<button type="button" data-action="partner-photo" data-photo="${photo}" class="partner-photo ${p.photo === photo ? 'selected' : ''}" aria-label="Choose ${photo} example photo" aria-pressed="${p.photo === photo}"><img src="assets/${photo}.jpg" alt="${photo === 'brunch' ? 'Avocado toast with fresh greens' : photo === 'pizza' ? 'Margherita pizza with basil' : 'Coffee and a croissant'}"></button>`).join('')}</div></section>`;
  }

  function menu(p) {
    return `${heading('Menu and FoodDex', 'The dishes they come back for.', 'Link each signature dish to the shared FoodDex catalogue.', btn('Add a dish', 'new-dish', 'btn btn-primary'))}<div class="grid-2">${p.menu.map(item => `<article class="card"><div class="section-heading"><span class="tag">${esc(item.dietary || 'Signature dish')}</span><strong>$${Number(item.price).toFixed(2)}</strong></div><h2>${esc(item.name)}</h2><p class="muted">${esc(item.description)}</p><p class="partner-small">FoodDex link: ${esc(item.canonical || item.name)}</p><div class="partner-actions">${btn('Edit dish', 'edit-dish', 'btn btn-secondary btn-small', `data-id="${esc(item.id)}"`)}${btn('Remove', 'remove-dish', 'btn btn-small', `data-id="${esc(item.id)}"`)}</div></article>`).join('')}</div>${p.menu.length ? '' : '<div class="empty-state"><h2>Your first signature dish</h2><p>Add a menu dish to make it discoverable in FoodDex.</p></div>'}${p.editor === 'dish' ? dishEditor(p) : ''}`;
  }

  function dishEditor(p) {
    const d = p.menu.find(item => item.id === p.editId) || {};
    return `<section class="card partner-editor"><div class="eyebrow">${d.id ? 'Edit dish' : 'New dish'}</div><h2>Something worth discovering.</h2><form id="partner-dish-form"><div class="form-grid">${field('name', 'Dish name', d.name || '', 'required minlength="2" maxlength="100"')}${field('price', 'Price in AUD', d.price || '', 'required min="0.5" max="500" step="0.5"', 'number')}${field('canonical', 'FoodDex catalogue link', d.canonical || '', 'required placeholder="For example, Avocado toast"')}<label class="field"><span>Dietary tag</span><select name="dietary">${['Vegetarian', 'Vegan', 'Gluten-free option', 'Contains dairy', 'Ask the venue'].map(v => `<option ${d.dietary === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="field full"><span>Description</span><textarea name="description" required minlength="5" rows="2">${esc(d.description || '')}</textarea></label></div><div class="partner-actions">${btn('Save dish', 'save-dish', 'btn btn-primary')}${btn('Cancel', 'cancel-editor')}</div></form></section>`;
  }

  function offers(p) {
    return `${heading('Explorer offers', 'A good reason to stop by.', 'Clear terms, useful rewards and a little neighbourhood generosity.', btn('Create offer', 'new-offer', 'btn btn-primary'))}${p.offers.map(offer => `<article class="card"><div class="section-heading"><div><span class="tag">${offer.active ? 'Active in demo' : 'Paused'}</span><h2>${esc(offer.name)}</h2></div>${btn(offer.active ? 'Pause offer' : 'Activate offer', 'toggle-offer', 'btn btn-secondary btn-small', `data-id="${esc(offer.id)}"`)}</div><p class="muted">${esc(offer.description)}</p><div class="partner-actions">${btn('Edit terms', 'edit-offer', 'btn btn-small btn-secondary', `data-id="${esc(offer.id)}"`)}<span class="partner-small muted">Redemption is simulated. No transaction is made.</span></div></article>`).join('')}${p.editor === 'offer' ? offerEditor(p) : ''}`;
  }

  function offerEditor(p) {
    const d = p.offers.find(item => item.id === p.editId) || {};
    return `<section class="card partner-editor"><h2>${d.id ? 'Edit your offer' : 'Create an explorer offer'}</h2><form id="partner-offer-form"><div class="form-grid">${field('name', 'Offer title', d.name || '', 'required minlength="3" maxlength="120"')}<label class="field full"><span>Offer details and redemption conditions</span><textarea name="description" rows="3" required minlength="15" maxlength="500" placeholder="Include the value, valid days, expiry and any limits.">${esc(d.description || '')}</textarea></label></div><div class="partner-actions">${btn('Save offer', 'save-offer', 'btn btn-primary')}${btn('Cancel', 'cancel-editor')}</div></form></section>`;
  }

  function team(p) {
    return `${heading('People behind the place', 'A table for your team.', 'Control who can update your venue. Platform review decisions stay with operators.')}<section class="card">${p.team.map((member, i) => `<div class="partner-team-row"><span class="partner-avatar">${esc(member.name.charAt(0))}</span><div><strong>${esc(member.name)}</strong><p class="muted">${esc(member.email)}</p></div><span class="tag">${esc(member.role)}</span>${i ? btn('Remove', 'remove-team', 'btn btn-small', `data-index="${i}"`) : ''}</div>`).join('')}<h2>Invite a teammate</h2><form id="partner-team-form"><div class="form-grid">${field('name', 'Name', '', 'required minlength="2"')}${field('email', 'Business email', '', 'required', 'email')}<label class="field"><span>Role</span><select name="role"><option>Venue manager</option><option>Menu editor</option><option>Staff</option></select></label></div><div class="partner-actions">${btn('Add demo teammate', 'invite-team', 'btn btn-primary')}</div><p class="partner-small muted">A local team preview. No invitation email is sent.</p></form></section>`;
  }

  function billing(p) {
    return `${heading('Partner subscription', 'Room to grow.', 'Compare a sample partner plan for the client presentation.')}<div class="grid-2"><section class="card partner-plan"><span class="eyebrow">Explorer partner</span><h2>Your next neighbourhood favourite.</h2><div class="partner-price">${p.subscribed ? 'Active' : 'Sample plan'}</div><p class="muted">Pricing is to be agreed. No price or payment commitment is created in this demo.</p><ul><li>Marketplace listing and menu tools</li><li>FoodDex and quest participation</li><li>Explorer offers and visit insights</li><li>Venue team access</li></ul>${btn(p.subscribed ? 'Cancel demo subscription' : 'Try subscription flow', 'subscribe', p.subscribed ? 'btn btn-secondary' : 'btn btn-primary')}</section><section class="card"><div class="eyebrow">Billing summary</div><h2>${p.subscribed ? 'You are all set for the demo.' : 'No subscription started.'}</h2><dl class="partner-review"><div><dt>Status</dt><dd>${p.subscribed ? 'Demo plan active' : 'No active plan'}</dd></div><div><dt>Payment method</dt><dd>Not collected</dd></div><div><dt>Transactions</dt><dd>None</dd></div></dl><p class="muted">Real subscriptions, customer payments, refunds and payouts are part of a later commercial stage.</p></section></div>`;
  }

  function review(p) {
    return `${heading('Operator workspace', 'A little care before going live.', 'Review ownership evidence and listing quality. This role is simulated separately from the venue owner.')}<div class="notice">Demo operator view. Approval changes this prototype only.</div>${p.queue.map(item => `<section class="card"><div class="section-heading"><div><span class="eyebrow">${esc(item.type)}</span><h2>${esc(item.name)}</h2><p class="muted">${esc(item.suburb)} · Victoria</p></div><span class="tag">${esc(item.status)}</span></div><p>${esc(item.evidence)}</p><div class="partner-actions">${btn('View evidence', 'evidence', 'btn btn-secondary btn-small', `data-id="${esc(item.id)}"`)}${item.status === 'Pending' ? `${btn('Approve demo listing', 'approve', 'btn btn-primary btn-small', `data-id="${esc(item.id)}"`)}${btn('Request changes', 'reject', 'btn btn-secondary btn-small', `data-id="${esc(item.id)}"`)}` : btn('Return to pending', 'pending', 'btn btn-secondary btn-small', `data-id="${esc(item.id)}"`)}</div>${p.evidenceId === item.id ? `<div class="partner-preview"><strong>Example evidence pack</strong><p>Business contact: ${esc(p.draft.email || example.email)}</p><p>Authorised business representative: confirmed in demo draft.</p><p>Ownership document: example document placeholder.</p><p class="muted">Production evidence must be validated through a trusted server review.</p></div>` : ''}</section>`).join('')}${p.queue.length ? '' : '<div class="empty-state"><h2>All caught up.</h2><p>No listings need review.</p></div>'}`;
  }

  function render(state, icon) {
    currentState = state;
    const p = partner(state);
    const html = `<div class="partner-studio"><div class="partner-topline"><span class="eyebrow">Food Go for venues</span><span class="partner-small muted">Partner studio · Interactive demo</span></div><nav class="tabs partner-tabs" aria-label="Partner studio sections">${tabs.map(([id, label]) => btn(label, 'tab', `btn ${p.tab === id && !p.onboarding ? 'active' : ''}`, `data-tab="${id}" aria-pressed="${p.tab === id && !p.onboarding}"`)).join('')}</nav>${p.onboarding ? onboarding(p) : ({ overview, venue, menu, offers, team, billing, review }[p.tab] || overview)(p)}</div>`;
    return html.replace(/(<form id="partner-[^"]+">)/g, '$1<button type="submit" hidden tabindex="-1" aria-hidden="true">Continue</button>');
  }

  function formData(id) {
    const form = document.getElementById(id);
    if (!form) return null;
    const phone = form.elements.namedItem('phone');
    if (phone) {
      const digits = phone.value.replace(/\D/g, '');
      phone.setCustomValidity(/^\+?[0-9 ()-]+$/.test(phone.value) && digits.length >= 8 && digits.length <= 15 ? '' : 'Enter a phone number with 8 to 15 digits.');
    }
    if (!form.reportValidity()) return null;
    return Object.fromEntries(new FormData(form).entries());
  }

  function readDraft(p) {
    const form = document.getElementById('partner-onboarding-form');
    if (!form) return;
    const values = Object.fromEntries(new FormData(form).entries());
    for (const key of Object.keys(defaultDraft)) if (key in values && !['gameEnabled', 'acceptedTerms'].includes(key)) p.draft[key] = values[key];
    if (form.elements.namedItem('gameEnabled')) p.draft.gameEnabled = form.elements.namedItem('gameEnabled').checked;
    if (form.elements.namedItem('acceptedTerms')) p.draft.acceptedTerms = form.elements.namedItem('acceptedTerms').checked;
  }

  function handle(action, element, context) {
    if (!action || !action.startsWith('partner-')) return false;
    const state = context.state || currentState;
    const p = partner(state);
    const notify = text => context.toast && context.toast(text);
    const value = name => element && element.dataset ? element.dataset[name] : undefined;
    const id = value('id');
    const cmd = action.slice(8);
    if (cmd === 'tab') { p.tab = value('tab') || 'overview'; p.onboarding = false; p.editor = null; }
    else if (cmd === 'start-onboarding') { p.onboarding = true; p.onboardingStep = 0; p.submitted = false; }
    else if (cmd === 'cancel-onboarding') p.onboarding = false;
    else if (cmd === 'prefill') { p.draft = { ...example }; p.claimed = false; notify('Example venue details filled in.'); }
    else if (cmd === 'claim-search') { readDraft(p); p.claimQuery = document.querySelector('[name="claimSearch"]')?.value.trim() || ''; p.claimSearched = true; }
    else if (cmd === 'claim') { readDraft(p); p.claimed = true; p.draft = { ...example, name: /ciao|carlton/i.test(p.claimQuery) ? 'Ciao, Carlton' : example.name }; notify('Existing venue linked to your draft. Ownership review is next.'); }
    else if (cmd === 'next') { if (!formData('partner-onboarding-form')) return true; readDraft(p); p.onboardingStep = (p.onboardingStep || 0) + 1; }
    else if (cmd === 'back') { readDraft(p); p.onboardingStep = Math.max(0, (p.onboardingStep || 0) - 1); }
    else if (cmd === 'edit-draft') { p.submitted = false; p.onboardingStep = 0; }
    else if (cmd === 'submit') { if (!formData('partner-onboarding-form')) return true; readDraft(p); p.submitted = true; p.queue.unshift({ id: 'submitted-' + Date.now(), name: p.draft.name, suburb: p.draft.suburb, type: p.claimed ? 'Ownership claim' : 'New venue', status: 'Pending', evidence: 'Example ownership evidence, venue details and authorisation supplied.' }); notify('Demo draft submitted for operator review.'); }
    else if (cmd === 'save-venue' || cmd === 'preview-venue') { const data = formData('partner-venue-form'); if (!data) return true; p.venue = { ...p.venue, ...data, gameEnabled: document.querySelector('#partner-venue-form [name="gameEnabled"]').checked }; p.hours = [data.open, data.close]; if (cmd === 'save-venue') { const venue = context.venues?.find(v => v.id === 'finch-and-field'); if (venue) Object.assign(venue, { name: p.venue.name, cuisine: p.venue.cuisine, suburb: p.venue.suburb, description: p.venue.description }); notify('Venue details saved across the demo.'); } else p.previewListing = !p.previewListing; }
    else if (cmd === 'photo') { p.photo = value('photo'); const venue = context.venues?.find(v => v.id === 'finch-and-field'); if (venue) venue.image = 'assets/' + p.photo + '.jpg'; notify('Listing photo updated across the demo.'); }
    else if (cmd === 'new-dish' || cmd === 'edit-dish') { p.editor = 'dish'; p.editId = cmd === 'edit-dish' ? id : null; }
    else if (cmd === 'save-dish') { const data = formData('partner-dish-form'); if (!data) return true; const index = p.menu.findIndex(item => item.id === p.editId); const dish = { ...data, id: p.editId || 'dish-' + Date.now() }; if (index >= 0) p.menu[index] = dish; else p.menu.push(dish); if (dish.id === 'toast') { const venue = context.venues?.find(v => v.id === 'finch-and-field'); if (venue) { venue.dish = dish.name; venue.dishPrice = Number(dish.price); } } p.editor = null; notify('Dish saved to the demo menu.'); }
    else if (cmd === 'remove-dish') { p.menu = p.menu.filter(item => item.id !== id); notify('Dish removed from the demo menu.'); }
    else if (cmd === 'new-offer' || cmd === 'edit-offer') { p.editor = 'offer'; p.editId = cmd === 'edit-offer' ? id : null; }
    else if (cmd === 'save-offer') { const data = formData('partner-offer-form'); if (!data) return true; const index = p.offers.findIndex(item => item.id === p.editId); const offer = { ...data, id: p.editId || 'offer-' + Date.now(), active: index >= 0 ? p.offers[index].active : true }; if (index >= 0) p.offers[index] = offer; else p.offers.push(offer); p.editor = null; notify('Explorer offer saved.'); }
    else if (cmd === 'toggle-offer') { const offer = p.offers.find(item => item.id === id); if (offer) { offer.active = !offer.active; notify(offer.active ? 'Demo offer activated.' : 'Demo offer paused.'); } }
    else if (cmd === 'cancel-editor') p.editor = null;
    else if (cmd === 'invite-team') { const data = formData('partner-team-form'); if (!data) return true; if (p.team.some(member => member.email.toLowerCase() === data.email.toLowerCase())) { notify('This email is already on the demo team.'); return true; } p.team.push(data); notify('Teammate added to the local demo. No email sent.'); }
    else if (cmd === 'remove-team') { const index = Number(value('index')); if (index > 0) p.team.splice(index, 1); notify('Demo teammate removed.'); }
    else if (cmd === 'subscribe') { p.subscribed = !p.subscribed; notify(p.subscribed ? 'Demo subscription active. No payment collected.' : 'Demo subscription cancelled.'); }
    else if (cmd === 'evidence') p.evidenceId = p.evidenceId === id ? null : id;
    else if (['approve', 'reject', 'pending'].includes(cmd)) { const item = p.queue.find(row => row.id === id); if (item) { item.status = cmd === 'approve' ? 'Approved in demo' : cmd === 'reject' ? 'Changes requested' : 'Pending'; notify(cmd === 'approve' ? 'Demo listing approved. No real venue published.' : cmd === 'reject' ? 'Demo changes requested.' : 'Listing returned to the demo queue.'); } }
    else return false;
    if (context.save) context.save();
    context.render();
    if (['new-dish', 'edit-dish', 'new-offer', 'edit-offer'].includes(cmd)) document.querySelector('.partner-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }

  const submitActions = { 'partner-onboarding-form': () => Number(currentState?.partner?.onboardingStep || 0) === 2 ? 'submit' : 'next', 'partner-venue-form': () => 'save-venue', 'partner-dish-form': () => 'save-dish', 'partner-offer-form': () => 'save-offer', 'partner-team-form': () => 'invite-team' };
  if (typeof document !== 'undefined') document.addEventListener('submit', event => {
    const action = submitActions[event.target.id];
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    event.target.querySelector('[data-action="partner-' + action() + '"]')?.click();
  }, true);

  window.FoodGoPartner = { render, handle };
})();
