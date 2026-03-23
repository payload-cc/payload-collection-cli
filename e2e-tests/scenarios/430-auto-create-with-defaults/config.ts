
			export const cliConfig = {
				mappings: {
					categories: {
						lookupField: 'name',
						onNotFound: 'create',
						defaults: {
							displayName: 'AUTO_CREATED_DISPLAY_NAME'
						}
					}
				}
			}
		