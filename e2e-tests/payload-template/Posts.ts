import type { CollectionConfig } from "payload";

export const Posts: CollectionConfig = {
	slug: "posts",
	fields: [
		{
			name: "title",
			type: "text",
			required: true,
		},
		{
			name: "author",
			type: "relationship",
			relationTo: "users",
			required: true,
		},
		{
			name: "category",
			type: "relationship",
			relationTo: "categories",
			required: true,
		},
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
	],
};
