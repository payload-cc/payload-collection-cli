import { CollectionConfig } from "payload";

export const Categories: CollectionConfig = {
	slug: "categories",
	admin: { useAsTitle: "name" },
	fields: [
		{ name: "name", type: "text", required: true, unique: true },
		{ name: "displayName", type: "text" },
		{
			name: "metadata",
			type: "group",
			fields: [
				{
					name: "reviewer",
					type: "relationship",
					relationTo: "users",
				},
			],
		},
		{
			name: "authors",
			type: "array",
			fields: [
				{
					name: "user",
					type: "relationship",
					relationTo: "users",
				},
			],
		},
	],
};
