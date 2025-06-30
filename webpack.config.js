const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const extensionConfig = {
    target: 'node',
    mode: 'none',
    entry: './src/extension.ts',
    output: {
        path: path.resolve(__dirname, 'out'),
        filename: 'extension.js',
        libraryTarget: 'commonjs2'
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader'
                    }
                ]
            }
        ]
    },
    externals: {
        vscode: 'commonjs vscode'
    },
    devtool: 'nosources-source-map',
    infrastructureLogging: {
        level: "log",
    },
};

const webviewConfig = {
    target: 'web',
    mode: 'none',
    entry: {
        gamePreview: './src/webview/gamePreview.ts',
        spriteEditor: './src/webview/spriteEditor.ts'
    },
    output: {
        path: path.resolve(__dirname, 'out', 'webview'),
        filename: '[name].js'
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader'
                    }
                ]
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'node_modules/phaser/dist/phaser.min.js',
                    to: 'phaser.min.js'
                }
            ]
        })
    ],
    devtool: 'nosources-source-map'
};

module.exports = [extensionConfig, webviewConfig];