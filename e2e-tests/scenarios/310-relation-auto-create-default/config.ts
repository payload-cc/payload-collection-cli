export const cliConfig = {
	mappings: {
		users: { lookupField: "email" },
		categories: {
			lookupField: "name",
			onNotFound: "create", // Fallback: if category doesn't exist, create it via CLI dynamically
		},
		posts: {
			defaults: {
				category: "default", // Fallback: if data lacks 'category', inject 'default'
			},
		},
	},
};
