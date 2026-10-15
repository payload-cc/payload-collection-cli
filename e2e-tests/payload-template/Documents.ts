import type { CollectionConfig } from "payload";
export const Documents: CollectionConfig = {
	slug: "documents",
	trash: true,
	versions: { drafts: true, maxPerDoc: 30 },
	fields: [
		{ name: "title", type: "text", required: true },
		{ name: "group", type: "text" },
	],
};
