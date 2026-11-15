import Link from "next/link";
export const metadata = { title: "Help and information" };
export default function HelpPage() {
  return <><header className="page-intro"><div><h1>How Food Go works</h1><p>Find a place, collect a discovery and share your story.</p></div></header>
    <div className="help-grid">
      <section className="help-card"><h2>Your account</h2><p>Choose food explorer or restaurant owner when you sign up. Confirm your email to sign in. Phone sign-in uses an Australian mobile code.</p>
        <p>Saved places, dishes, verified discoveries and XP belong to your account.</p><Link href="/auth/register">Create an account</Link></section>
      <section className="help-card"><h2>Explore and directions</h2><p>Search worldwide, select a place and open Google Maps or Apple Maps. Place your explorer and follow a pedestrian route, or allow live location to follow your device. Virtual walking does not earn verified XP.</p>
        <p>Streets work worldwide. Satellite coverage depends on the configured provider; local Melbourne imagery is labelled.</p><Link href="/">Explore the map</Link></section>
      <section className="help-card"><h2>Collect XP</h2><p>Ask the restaurant for its visit QR when you arrive, or a code for the dish you tried. Codes expire after ten minutes. Each place earns 50 XP once and each dish earns 100 XP once. Three different places earn a further 100 XP.</p>
        <p>Codes for a venue's own staff accounts cannot earn discoveries at that venue. XP tracks progress and has no cash value.</p><Link href="/collect">Collect a discovery</Link></section>
      <section className="help-card"><h2>Feed and Passport</h2><p>Post public stories or keep a post private. Food Go reviews public stories and replies. Approved contributions, likes received and unique signed-in reach count towards your progress.</p>
        <p>Use a post's menu to report content or block another account. Passport holds your own wall.</p><Link href="/feed">Open Feed</Link></section>
      <section className="help-card"><h2>Restaurant owners</h2><p>Your dashboard holds listing details, menu items, offers and customer verification codes. Submit your listing for ownership review. An operator verifies and publishes it before customers can discover it.</p>
        <p>New offers need operator approval. Changing the restaurant name or address triggers a fresh review.</p><Link href="/partner/dashboard">My restaurants</Link></section>
      <section className="help-card"><h2>Privacy and account access</h2><p>Your saved list and private posts are visible to your account. Restaurant operators see their business submissions and customer discovery totals. Public Feed displays your explorer name.</p>
        <p>Live location starts only when you allow it and stops when Explore is hidden or closed. GPS fixes stay in this page. Map providers receive requests for the viewed area; searches and walking route endpoints go to their providers. You can explore manually without location permission.</p>
        <p>Use the password recovery screen if you cannot sign in. Confirm dietary needs, prices and availability directly with the venue.</p><Link href="/auth/forgot-password">Recover account access</Link></section>
    </div></>;
}
