# Entry activation checks

Run `node scripts/check-entry-local.mjs` from `site` before every build intended
for review or publication. The script works from another directory using its
absolute path as well. It reads no private answer datasets or environment files. It does read the production API and Gift registration source internally for duplicate-key inspection, then replaces registrations before synthetic execution.

This is the activation gate for globally unique salted registrations. It scans
literal keys in the server's original/hidden/guest/weekly registry and the Gift
book/cover registry before JavaScript object construction or spread can erase a
duplicate. A duplicate blocks activation even when its metadata appears equal.
Errors omit registration keys and private metadata. If another server registry
is introduced, add it to this gate before importing or spreading its entries.

The same suite uses synthetic words and salt to verify original and Gift acts,
cover and outlet/PinPoint/Pinterest guests, legacy routes, hidden-entry limits,
rate limiting, missing configuration, and the complete server-owned route tuple.
Catalog rows and selected-book query parameters cannot authorize new routes.
For another Gift under an existing parent, add its public catalog record, one
server `ENTRY_POLICY.books` record, and unique server hash registrations carrying
that explicit `bookId`. Gift puzzle content and words are independent, while its
rooms inherit the parent's registered room set and act route. No new conditional
branches are needed for additional Gift editions. Legacy registrations without
`bookId` retain the original/current-Gift aliases.

Activate a new parent only by adding its explicit `ENTRY_POLICY.parents` route
after its real room set, reward behavior, printed label, and stable route have
been approved. Catalog records alone cannot activate it. Synthetic fixtures prove
five parent families with an original and five Gifts per family; these fixtures
do not create public books or register future production hashes.

Run `node scripts/check-gift-local.mjs` from `site` for the existing production
Gift regression. That established checker reads local private sources internally;
never print those sources or their values. It mocks notifications/rewards and
blocks global fetch before executing unlock cases. Its output is summary counts.

Both checks must pass. These local results do not prove deployment, physical
book instructions, real browser persistence, or real reward delivery. Publication
remains a separate owner-authorized step.
