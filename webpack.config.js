const path = require('path');
const HTMLWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
global.nostd = true; // builder module thingy, not actual something webpack handles

const babelLoader = [
    /* // isnt necessary for webpack to work, and is currently just creating worse issues
    {
        loader: 'babel-loader',
        options: {
            targets: 'defaults',
            sourceType: 'module',
            presets: [['@babel/preset-env', {
                modules: 'commonjs' // or 'commonjs' for explicit CJS output
            }]]
        }
    }
    */ 
]
const base = {
    mode: process.env.MODE || 'development',
    devtool: 'inline-source-map',
    cache: false,
    output: {
        path: path.resolve('./dist'),
        filename: '[name].js',
        publicPath: ''
    },
    module: {
        rules: [
            {
                test: /\.[jt]sx$/,
                use: [
                    ...babelLoader,
                    { loader: path.resolve('./preprocessors/javascript-xml.precomp.js') }
                ]
            },
            {
                test: /\.[cm]?[jt]s?$/,
                use: [...babelLoader]
            },
            {
                test: /\.(png|jpe?g|gif|apng|webp|svg|avif)$/i,
                use: [
                    ...babelLoader,
                    { loader: path.resolve('./preprocessors/image-loader.js') },
                ]
            },
            {
                test: /\.css$/,
                use: [
                    ...babelLoader,
                    { loader: path.resolve('./preprocessors/style-loader.js') },
                    // { loader: 'css-loader' }
                ]
            },
            {
                test: /\.proto$/,
                use: [
                    ...babelLoader,
                    { loader: path.resolve('./preprocessors/protobuf-file.precomp.js') }
                ]
            }
        ]
    }
}
module.exports = [
    {
        ...base,
        entry: {
            page: './src/index.jsx',
            browser: './webpage/browser.jsx',
            jsxHelpers: './webpage/embeded-helpers.js',
            long: './webpage/long.js'
        },
        plugins: [
            new HTMLWebpackPlugin({
                template: './webpage/discordnt.ejs',
                filename: 'discordnt.html',
                inject: false,
                pathTo: path.resolve('./webpage'),
                develop: process.env.MODE !== 'production'
            })
        ]
    }, /* need to fix the nodejs compile routine, for now just ignore its existence
    honestly might just make this happen with the original builder instead since 
    node support in webpack seems like its true and utter shittium, and the server
    really doesnt build that slowly
    {
        ...base,
        target: 'node',
        entry: {
            server: './server/index.js'
        }
    } */
]
