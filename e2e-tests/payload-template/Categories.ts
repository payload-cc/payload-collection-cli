import { CollectionConfig } from "payload";

export const Categories: CollectionConfig = {
	slug: "categories",
	admin: { useAsTitle: "name" },
	fields: [
		{ name: "name", type: "text", required: true, unique: true },
		{ name: "displayName", type: "text" },
	],
};
