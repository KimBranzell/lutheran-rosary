const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { InjectManifest } = require('workbox-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/main.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      clean: true,
    },
    experiments: {
      css: true,
    },
    module: {
      rules: [
        {
          test: /\.s[ac]ss$/i,
          type: 'css/auto',
          use: ['sass-loader'],
        },
        {
          test: /\.woff2?$/i,
          type: 'asset/resource',
          generator: {
            filename: 'fonts/[name][ext]',
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        // Inject into <head> (with the default deferred script loading) so the
        // entry chunk starts downloading alongside the stylesheet instead of
        // only once the parser reaches </body>.
        inject: 'head',
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'public',
            to: '.',
            globOptions: { ignore: ['**/index.html'] },
          },
          {
            from: 'src/data/generated/scripture-passages.json',
            to: 'scripture-passages.json',
          },
        ],
      }),
      ...(isProduction
        ? [
            new InjectManifest({
              swSrc: './src/service-worker.js',
              swDest: 'service-worker.js',
              maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            }),
          ]
        : []),
    ],
    devServer: {
      static: {
        directory: path.resolve(__dirname, 'public'),
      },
      port: 8080,
      hot: true,
    },
    devtool: isProduction ? false : 'source-map',
  };
};
