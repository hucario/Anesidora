/*globals module */
module.exports = {
	root: true,
	env: {
		browser: true,
		es2021: true
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 12,
		sourceType: 'module'
	},
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
	rules: {
		indent: [
			'error',
			4
		],
		'linebreak-style': [
			'error',
			'unix'
		],
		quotes: [
			'error',
			'single'
		],
		semi: [
			'error',
			'always'
		],
		'no-console': 0
	}
};