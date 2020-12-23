module.exports = {
    parser: '@typescript-eslint/parser', // Specifies the ESLint parser
    parserOptions: {
        ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
        sourceType: 'module', // Allows for the use of imports
        project: ['./tsconfig.json', './examples/tsconfig.json'],
    },
    extends: [
        'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
    ],
    plugins: [],
    rules: {
        'indent': 'off',
        '@typescript-eslint/indent': [
            'error',
            2,
            {
                'SwitchCase': 1,
                'MemberExpression': 'off'
            }
        ],
        'quotes': [
            'error',
            'single',
            {
                'avoidEscape': true,
                'allowTemplateLiterals': true
            }
        ],
        '@typescript-eslint/type-annotation-spacing': 'warn',
        'keyword-spacing': 'warn',
        'space-before-blocks': 'warn',
        'array-bracket-spacing': [ 'warn', 'always'],
        'object-curly-spacing': [ 'warn', 'always'],
        'arrow-spacing': 'warn',
        'space-before-function-paren': 'warn',
        '@typescript-eslint/no-parameter-properties': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-use-before-define': [
            'error',
            {
                functions: false,
                typedefs: false,
                classes: false,
            },
        ],
        '@typescript-eslint/no-unused-vars': [
            'warn',
            {
                ignoreRestSiblings: true,
                argsIgnorePattern: '^_',
            },
        ],
        '@typescript-eslint/explicit-function-return-type': [
            'warn',
            {
                allowExpressions: true,
                allowTypedFunctionExpressions: true,
            },
        ],
        '@typescript-eslint/no-object-literal-type-assertion': 'off',
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/no-inferrable-types': 'off',
        '@typescript-eslint/no-namespace': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off', // This is necessary for Map.has()/get()!
        'no-var': 'error',
        'prefer-const': 'error',
        'no-trailing-spaces': 'warn',
    }
};