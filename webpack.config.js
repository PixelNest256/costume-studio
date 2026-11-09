const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ScratchWebpackConfigBuilder = require('scratch-webpack-configuration');

const isProduction = process.env.NODE_ENV === 'production';

const config = new ScratchWebpackConfigBuilder({
    rootPath: __dirname,
    enableReact: true,
    cssModuleExceptions: [/\.global\.css$/]
})
    .setTarget('web')
    .merge({
        entry: {
            app: path.resolve(__dirname, 'src/index.jsx')
        },
        output: {
            path: path.resolve(__dirname, 'dist'),
            publicPath: './',
            filename: isProduction ? 'assets/[name].[contenthash:8].js' : 'assets/[name].js',
            chunkFilename: isProduction ? 'chunks/[name].[contenthash:8].js' : 'chunks/[name].js',
            assetModuleFilename: 'assets/[name].[contenthash:8][ext]',
            clean: true
        },
        devtool: isProduction ? false : 'eval-cheap-module-source-map',
        performance: {
            hints: false
        },
        devServer: {
            host: 'localhost',
            port: 5173,
            // HtmlWebpackPlugin generates the served index; don't let the
            // static template in public/ shadow it in development.
            static: false,
            devMiddleware: {
                publicPath: '/'
            },
            hot: true,
            open: false,
            client: {
                overlay: true
            }
        },
        resolve: {
            alias: {
                // Costume Studio ships a fork of @scratch/scratch-paint 15.3.0 with
                // TurboWarp/PenguinMOD-style tools integrated into the editor itself.
                '@scratch/scratch-paint$': path.resolve(__dirname, 'src/vendor/scratch-paint/index.js'),
                // Use the redistributable Scratch UI fonts. Upstream's Scratch.ttf
                // has no redistribution permission; the browser build must omit it.
                'scratch-render-fonts$': path.resolve(__dirname, 'src/vendor/scratch-render-fonts.js')
            }
        }
    })
    .addModuleRule({
        test: /\.(svg|png|jpg|jpeg|gif|webp)$/i,
        resourceQuery: /^$/,
        type: 'asset'
    })
    .addPlugin(new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'public/index.html'),
        favicon: path.resolve(__dirname, 'public/favicon.svg'),
        title: 'Costume Studio',
        inject: 'body',
        scriptLoading: 'defer',
        meta: {
            description: 'A standalone Scratch-style costume editor for SVG and bitmap costumes.',
            'theme-color': '#f7f4ee'
        }
    }));

const resolvedConfig = config.get();

// scratch-webpack-configuration 3.1.3 only whitelists unscoped scratch-*/src paths for
// Babel. The published packages we use are scoped (@scratch/scratch-paint and
// @scratch/scratch-svg-renderer), so extend the exception to their source entries.
const babelRule = resolvedConfig.module.rules.find(rule => rule.loader === 'babel-loader');
if (babelRule) {
    babelRule.exclude = {
        and: [/node_modules/],
        not: [/node_modules[\\/](?:@scratch[\\/])?scratch-(?:paint|render|svg-renderer|vm)[\\/]src[\\/]/]
    };
}

module.exports = resolvedConfig;
